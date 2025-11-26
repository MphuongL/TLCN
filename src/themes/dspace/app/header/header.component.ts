import { Component, OnInit } from '@angular/core';
import { HeaderComponent as BaseComponent } from '../../../../app/header/header.component';
import { Observable } from 'rxjs';
import { MenuID } from 'src/app/shared/menu/menu-id.model';

/**
 * Represents the header with the logo and simple navigation
 */
@Component({
  selector: 'ds-header',
  styleUrls: ['header.component.scss'],
  templateUrl: 'header.component.html',
})
export class HeaderComponent extends BaseComponent implements OnInit {
  public isNavBarCollapsed$: Observable<boolean>;
  public isSidebarVisible$: Observable<boolean>;

  ngOnInit() {
    super.ngOnInit();
    this.isSidebarVisible$ = this.menuService.isMenuVisibleWithVisibleSections(
      MenuID.ADMIN
    );
    this.isNavBarCollapsed$ = this.menuService.isMenuCollapsed(this.menuID);
  }
}
