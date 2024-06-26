import { Jsonify } from "type-fest";

import { Account as BaseAccount } from "@bitwarden/common/platform/models/domain/account";

import { BrowserComponentState } from "./browserComponentState";
import { BrowserGroupingsComponentState } from "./browserGroupingsComponentState";
import { BrowserSendComponentState } from "./browserSendComponentState";

export class Account extends BaseAccount {
  groupings?: BrowserGroupingsComponentState;
  send?: BrowserSendComponentState;
  ciphers?: BrowserComponentState;
  sendType?: BrowserComponentState;

  constructor(init: Partial<Account>) {
    super(init);

    this.groupings = init?.groupings ?? new BrowserGroupingsComponentState();
    this.send = init?.send ?? new BrowserSendComponentState();
    this.ciphers = init?.ciphers ?? new BrowserComponentState();
    this.sendType = init?.sendType ?? new BrowserComponentState();
  }

  static fromJSON(json: Jsonify<Account>): Account {
    if (json == null) {
      return null;
    }

    return Object.assign(new Account({}), json, super.fromJSON(json), {
      groupings: BrowserGroupingsComponentState.fromJSON(json.groupings),
      send: BrowserSendComponentState.fromJSON(json.send),
      ciphers: BrowserComponentState.fromJSON(json.ciphers),
      sendType: BrowserComponentState.fromJSON(json.sendType),
    });
  }
}
