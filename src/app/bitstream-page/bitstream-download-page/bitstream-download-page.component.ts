import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location, isPlatformServer } from '@angular/common';
import { map, take } from 'rxjs/operators';
import { of as observableOf, Observable } from 'rxjs';
import { Bitstream } from '../../core/shared/bitstream.model';
import { AuthService } from '../../core/auth/auth.service';
import { AuthorizationDataService } from '../../core/data/feature-authorization/authorization-data.service';
import { FeatureID } from '../../core/data/feature-authorization/feature-id';
import { HardRedirectService } from '../../core/services/hard-redirect.service';
import { FileService } from '../../core/shared/file.service';
import { getRemoteDataPayload } from '../../core/shared/operators';
import { redirectOn4xx } from '../../core/shared/authorized.operators';
import { HttpClient } from '@angular/common/http';
import { DSONameService } from '../../core/breadcrumbs/dso-name.service';
import { SignpostingDataService } from '../../core/data/signposting-data.service';
import { ServerResponseService } from '../../core/services/server-response.service';
import { SignpostingLink } from '../../core/data/signposting-links.model';

@Component({
  selector: 'ds-bitstream-download-page',
  templateUrl: './bitstream-download-page.component.html'
})
export class BitstreamDownloadPageComponent implements OnInit {

  bitstream$: Observable<Bitstream>;
  bitstreamRD$: any;
  signedUrl: string | null = null;


  // user fields: email và name tự động, chỉ nhập password
  userEmail = '';
  userName = '';
  userPassword = '';

  lcpBridgeUrl = 'http://localhost:9001/api/lcp/download';

  constructor(
    private route: ActivatedRoute,
    protected router: Router,
    private authorizationService: AuthorizationDataService,
    private auth: AuthService,
    private fileService: FileService,
    private hardRedirectService: HardRedirectService,
    private location: Location,
    public dsoNameService: DSONameService,
    private signpostingDataService: SignpostingDataService,
    private responseService: ServerResponseService,
    private http: HttpClient,
    @Inject(PLATFORM_ID) protected platformId: string
  ) {
    this.initPageLinks();
  }

  back(): void {
    this.location.back();
  }

  ngOnInit(): void {
    this.bitstreamRD$ = this.route.data.pipe(map((data) => data.bitstream));
    this.bitstream$ = this.bitstreamRD$.pipe(
      redirectOn4xx(this.router, this.auth),
      getRemoteDataPayload()
    );

    this.loadUserInfo();
    // LẤY SIGNED URL
    this.bitstream$.pipe(take(1)).subscribe((bitstream) => {
      if (bitstream) {
        const rawUrl = `http://host.docker.internal:8080/server/api/core/bitstreams/${bitstream.id}/content`;

        this.fileService.retrieveFileDownloadLink(rawUrl).subscribe(url => {
          this.signedUrl = url;
        });
      }
    });
  }

  /** 
   * Tự động lấy thông tin người dùng từ AuthService hoặc token 
   */
  private loadUserInfo(): void {
    const tryMethods = [
      'getAuthenticatedUser',
      'getCurrentUser',
      'getUser',
      'getAuthenticatedUserFromStore',
      'getUserFromStore'
    ];

    let found = false;

    for (const m of tryMethods) {
      const fn = (this.auth as any)[m];
      if (typeof fn === 'function') {
        try {
const result = fn.call(this.auth);
          if (result && typeof result.subscribe === 'function') {
            result.subscribe((user: any) => {
              if (user) {
                this.userEmail = user.email || '';
                this.userName = user.name || user.fullName || this.userName;
              }
            });
          } else if (result && typeof result === 'object') {
            const user = result;
            this.userEmail = user.email || '';
            this.userName = user.name || user.fullName || '';
          }
          found = true;
          break;
        } catch (e) {
          console.warn(`Tried AuthService.${m}() but failed:`, e);
        }
      }
    }

    if (!found) {
      const token = (this.auth as any).token || (this.auth as any).authToken || null;
      if (token && typeof token === 'string') {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          this.userEmail = payload.email || payload.sub || '';
          this.userName = payload.name || payload.username || '';
        } catch {
          console.warn('Cannot parse token payload to extract user info.');
        }
      }
    }
  }

  /**
   * Gọi API LCP để tải file mã hóa (user chỉ nhập password)
   */
  downloadEncrypted(): void {
    if (!this.userPassword) {
      alert('Vui lòng nhập mật khẩu!');
      return;
    }

    this.bitstream$.pipe(take(1)).subscribe((bitstream) => {

      const apiUrl = `${this.lcpBridgeUrl}/${bitstream.id}`;
      const body = {
        userEmail: this.userEmail,
        userName: this.userName,
        userPassword: this.userPassword,
        signedUrl: this.signedUrl  // <- thêm vào đây
      };

      this.http.post(apiUrl, body, { responseType: 'blob' }).subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${bitstream.id}.lcpl`;
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: (err) => {
          console.error('Error requesting LCP license:', err);
          alert('Không thể tạo/tải license LCP. Kiểm tra console.');
        }
      });

    });
  }



  private initPageLinks(): void {
    if (isPlatformServer(this.platformId)) {
      this.route.params.subscribe(params => {
        this.signpostingDataService.getLinks(params.id).pipe(take(1)).subscribe((signpostingLinks: SignpostingLink[]) => {
          let links = '';
          signpostingLinks.forEach((link: SignpostingLink) => {
            links = links + (links ? ', ' : '') + `<${link.href}> ; rel="${link.rel}"` + (link.type ? ` ; type="${link.type}" ` : ' ');
          });
          this.responseService.setHeader('Link', links);
        });
      });
    }
  }
}