import { Inject, Injectable } from "@angular/core";

import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import { AbstractThemingService } from "@bitwarden/angular/services/theming/theming.service.abstraction";
import { CryptoService as CryptoServiceAbstraction } from "@bitwarden/common/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/abstractions/encrypt.service";
import { EnvironmentService as EnvironmentServiceAbstraction } from "@bitwarden/common/abstractions/environment.service";
import { EventUploadService as EventUploadServiceAbstraction } from "@bitwarden/common/abstractions/event/event-upload.service";
import { I18nService as I18nServiceAbstraction } from "@bitwarden/common/abstractions/i18n.service";
import { NotificationsService as NotificationsServiceAbstraction } from "@bitwarden/common/abstractions/notifications.service";
import { StateService as StateServiceAbstraction } from "@bitwarden/common/abstractions/state.service";
import { VaultTimeoutService as VaultTimeoutServiceAbstraction } from "@bitwarden/common/abstractions/vaultTimeout/vaultTimeout.service";
import { TwoFactorService as TwoFactorServiceAbstraction } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { ContainerService } from "@bitwarden/common/services/container.service";
import { EventUploadService } from "@bitwarden/common/services/event/event-upload.service";
import { VaultTimeoutService as VaultTimeoutService } from "@bitwarden/common/services/vaultTimeout/vaultTimeout.service";

import { I18nService } from "./i18n.service";

@Injectable()
export class InitService {
  constructor(
    @Inject(WINDOW) private win: Window,
    private environmentService: EnvironmentServiceAbstraction,
    private notificationsService: NotificationsServiceAbstraction,
    private vaultTimeoutService: VaultTimeoutServiceAbstraction,
    private i18nService: I18nServiceAbstraction,
    private eventUploadService: EventUploadServiceAbstraction,
    private twoFactorService: TwoFactorServiceAbstraction,
    private stateService: StateServiceAbstraction,
    private cryptoService: CryptoServiceAbstraction,
    private themingService: AbstractThemingService,
    private encryptService: EncryptService
  ) {}

  init() {
    function getBaseUrl() {
      // If the base URL is `https://vaultwarden.example.com/base/path/`,
      // `window.location.href` should have one of the following forms:
      //
      // - `https://vaultwarden.example.com/base/path/`
      // - `https://vaultwarden.example.com/base/path/#/some/route[?queryParam=...]`
      //
      // We want to get to just `https://vaultwarden.example.com/base/path`.
      let baseUrl = window.location.href;
      baseUrl = baseUrl.replace(/#.*/, ""); // Strip off `#` and everything after.
      baseUrl = baseUrl.replace(/\/+$/, ""); // Trim any trailing `/` chars.
      return baseUrl;
    }
    return async () => {
      // Workaround to ignore stateService.activeAccount until process.env.URLS are set
      // TODO: Remove this when implementing ticket PM-2637
      this.environmentService.initialized = false;
      await this.stateService.init();

      const urls = { base: getBaseUrl() };
      this.environmentService.setUrls(urls);
      this.environmentService.initialized = true;

      setTimeout(() => this.notificationsService.init(), 3000);
      (this.vaultTimeoutService as VaultTimeoutService).init(true);
      const locale = await this.stateService.getLocale();
      await (this.i18nService as I18nService).init(locale);
      (this.eventUploadService as EventUploadService).init(true);
      this.twoFactorService.init();
      const htmlEl = this.win.document.documentElement;
      htmlEl.classList.add("locale_" + this.i18nService.translationLocale);
      await this.themingService.monitorThemeChanges();
      const containerService = new ContainerService(this.cryptoService, this.encryptService);
      containerService.attachToGlobal(this.win);
    };
  }
}
