import { Component, Input, OnInit } from '@angular/core';
import { Bitstream } from '../../core/shared/bitstream.model';
import {
  getBitstreamDownloadRoute,
  getBitstreamRequestACopyRoute,
} from '../../app-routing-paths';
import { DSONameService } from '../../core/breadcrumbs/dso-name.service';
import { AuthorizationDataService } from '../../core/data/feature-authorization/authorization-data.service';
import { FeatureID } from '../../core/data/feature-authorization/feature-id';
import { hasValue, isNotEmpty } from '../empty.util';
import { map } from 'rxjs/operators';
import {
  of as observableOf,
  combineLatest as observableCombineLatest,
  Observable,
} from 'rxjs';
import { Item } from '../../core/shared/item.model';
import { FileService } from '../../core/shared/file.service';
@Component({
  selector: 'ds-file-download-link',
  templateUrl: './file-download-link.component.html',
  styleUrls: ['./file-download-link.component.scss'],
})
/**
 * Component displaying a download link
 * When the user is authenticated, a short-lived token retrieved from the REST API is added to the download link,
 * ensuring the user is authorized to download the file.
 */
export class FileDownloadLinkComponent implements OnInit {
  /**
   * Optional bitstream instead of href and file name
   */
  @Input() bitstream: Bitstream;

  @Input() item: Item;

  /**
   * Additional css classes to apply to link
   */
  @Input() cssClasses = '';

  /**
   * A boolean representing if link is shown in same tab or in a new one.
   */
  @Input() isBlank = false;

  @Input() enableRequestACopy = true;

  bitstreamPath$: Observable<{
    routerLink: string;
    queryParams: any;
  }>;

  canDownload$: Observable<boolean>;
  secureViewerUrl$: Observable<string>;
  constructor(
    private authorizationService: AuthorizationDataService,
    public dsoNameService: DSONameService,
    private fileService: FileService
  ) {}

  ngOnInit() {
    if (this.enableRequestACopy) {
      // Sửa lỗi: Thêm 'undefined' sau ':'
      this.canDownload$ = this.authorizationService.isAuthorized(
        FeatureID.CanDownload,
        isNotEmpty(this.bitstream) ? this.bitstream.self : undefined
      );
      const canRequestACopy$ = this.authorizationService.isAuthorized(
        FeatureID.CanRequestACopy,
        isNotEmpty(this.bitstream) ? this.bitstream.self : undefined
      );
      this.bitstreamPath$ = observableCombineLatest([
        this.canDownload$,
        canRequestACopy$,
      ]).pipe(
        map(([canDownload, canRequestACopy]) =>
          this.getBitstreamPath(canDownload, canRequestACopy)
        )
      );
    } else {
      this.bitstreamPath$ = observableOf(this.getBitstreamDownloadPath());
      this.canDownload$ = observableOf(true);
    }
    if (hasValue(this.bitstream)) {
      const bitstreamUrl = `http://localhost:8080/server/api/core/bitstreams/${this.bitstream.id}/content`;
      this.secureViewerUrl$ = this.fileService
        .retrieveFileDownloadLink(bitstreamUrl)
        .pipe(
          map(
            (signedUrl) =>
              `/assets/secure-viewer/viewer.html?url=${encodeURIComponent(
                'http://localhost:9000/viewer?url=' + signedUrl
              )}`
          )
        );
    }
  }

  get bitstreamHref(): string | null {
    if (!this.bitstream) {
      return null;
    }

    return `http://localhost:8080/server/api/core/bitstreams/${this.bitstream.id}/content`;
  }

  get previewHref(): string {
    if (!this.bitstream) {
      return null;
    }

    return `http://localhost:8080/server/api/core/bitstreams/${this.bitstream.id}/preview`;
  }

  getBitstreamPath(canDownload: boolean, canRequestACopy: boolean) {
    if (!canDownload && canRequestACopy && hasValue(this.item)) {
      return getBitstreamRequestACopyRoute(this.item, this.bitstream);
    }
    return this.getBitstreamDownloadPath();
  }

  getBitstreamDownloadPath() {
    return {
      routerLink: getBitstreamDownloadRoute(this.bitstream),
      queryParams: {},
    };
  }

  handlePreview(): void {
    const href = this.previewHref;
    if (!href) {
      return;
    }

    this.fileService.retrieveFileDownloadLink(href).subscribe((signedUrl) => {
      // disable toolbar
      const previewUrl = `${signedUrl}#toolbar=0&navpanes=0&scrollbar=0`;
      window.open(previewUrl, '_blank');
    });
  }

  DownloadLCP(): void {
    const href = this.bitstreamHref;
    if (!href) {
      return;
    }

    this.fileService.retrieveFileDownloadLink(href).subscribe((signedUrl) => {
      // Gọi FastAPI viewer, giữ các query params và disable toolbar
      const signedUrlForLinux = signedUrl.replace(
        'localhost',
        'host.docker.internal'
      );
      const previewUrl = `http://localhost:9000/viewer?url=${encodeURIComponent(
        signedUrlForLinux
      )}#toolbar=0&navpanes=0&scrollbar=0`;
      window.open(previewUrl, '_blank');
    });
  }
}
