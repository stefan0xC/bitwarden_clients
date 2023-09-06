import { ThemeType } from "@bitwarden/common/enums";
import { GlobalState as BaseGlobalState } from "@bitwarden/common/platform/models/domain/global-state";

export class GlobalState extends BaseGlobalState {
  theme?: ThemeType = ThemeType.System;
  rememberEmail = true;
}
