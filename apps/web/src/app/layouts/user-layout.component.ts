import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { RouterModule } from "@angular/router";
import { Observable, of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { IconModule, LayoutComponent, NavigationModule } from "@bitwarden/components";

import { PaymentMethodWarningsModule } from "../billing/shared";

import { PasswordManagerLogo } from "./password-manager-logo";
import { ToggleWidthComponent } from "./toggle-width.component";

@Component({
  selector: "app-user-layout",
  templateUrl: "user-layout.component.html",
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    LayoutComponent,
    IconModule,
    NavigationModule,
    PaymentMethodWarningsModule,
    ToggleWidthComponent,
  ],
})
export class UserLayoutComponent implements OnInit {
  protected readonly logo = PasswordManagerLogo;
  protected hasFamilySponsorshipAvailable$: Observable<boolean>;
  protected showSubscription$: Observable<boolean>;

  protected showPaymentMethodWarningBanners$ = this.configService.getFeatureFlag$(
    FeatureFlag.ShowPaymentMethodWarningBanners,
  );

  constructor(
    private platformUtilsService: PlatformUtilsService,
    private organizationService: OrganizationService,
    private apiService: ApiService,
    private syncService: SyncService,
    private configService: ConfigService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
  ) {}

  async ngOnInit() {
    document.body.classList.remove("layout_frontend");

    await this.syncService.fullSync(false);

    this.hasFamilySponsorshipAvailable$ = of(false); // disable family Sponsorships in Vaultwarden
    this.showSubscription$ = of(false); // always hide subscriptions in Vaultwarden
  }
}
