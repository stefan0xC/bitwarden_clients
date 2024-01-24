import { Inject, Injectable } from "@angular/core";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import { EventUploadService as EventUploadServiceAbstraction } from "@bitwarden/common/abstractions/event/event-upload.service";
import { NotificationsService as NotificationsServiceAbstraction } from "@bitwarden/common/abstractions/notifications.service";
import { TwoFactorService as TwoFactorServiceAbstraction } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { CryptoService as CryptoServiceAbstraction } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { EnvironmentService as EnvironmentServiceAbstraction } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService as I18nServiceAbstraction } from "@bitwarden/common/platform/abstractions/i18n.service";
import { StateService as StateServiceAbstraction } from "@bitwarden/common/platform/abstractions/state.service";
import { ConfigService } from "@bitwarden/common/platform/services/config/config.service";
import { ContainerService } from "@bitwarden/common/platform/services/container.service";
import { EventUploadService } from "@bitwarden/common/services/event/event-upload.service";
import { VaultTimeoutService } from "@bitwarden/common/services/vault-timeout/vault-timeout.service";

import { I18nService } from "../core/i18n.service";

@Injectable()
export class InitService {
  constructor(
    @Inject(WINDOW) private win: Window,
    private environmentService: EnvironmentServiceAbstraction,
    private notificationsService: NotificationsServiceAbstraction,
    private vaultTimeoutService: VaultTimeoutService,
    private i18nService: I18nServiceAbstraction,
    private eventUploadService: EventUploadServiceAbstraction,
    private twoFactorService: TwoFactorServiceAbstraction,
    private stateService: StateServiceAbstraction,
    private cryptoService: CryptoServiceAbstraction,
    private themingService: AbstractThemingService,
    private encryptService: EncryptService,
    private configService: ConfigService,
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
      await this.stateService.init();

      const urls = { base: getBaseUrl() };
      await this.environmentService.setUrls(urls);
      // Workaround to ignore stateService.activeAccount until process.env.URLS are set
      // TODO: Remove this when implementing ticket PM-2637
      this.environmentService.initialized = true;

      setTimeout(() => this.notificationsService.init(), 3000);
      await this.vaultTimeoutService.init(true);
      const locale = await this.stateService.getLocale();
      await (this.i18nService as I18nService).init(locale);
      (this.eventUploadService as EventUploadService).init(true);
      this.twoFactorService.init();
      const htmlEl = this.win.document.documentElement;
      htmlEl.classList.add("locale_" + this.i18nService.translationLocale);
      await this.themingService.monitorThemeChanges();
      const containerService = new ContainerService(this.cryptoService, this.encryptService);
      containerService.attachToGlobal(this.win);

      this.configService.init();
    };
  }
}
