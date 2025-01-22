// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { inject, Injectable } from "@angular/core";
import { combineLatest, filter, firstValueFrom, map, switchMap } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { OrganizationUserStatusType, PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";

import {
  CipherFormConfig,
  CipherFormConfigService,
  CipherFormMode,
} from "../abstractions/cipher-form-config.service";

/**
 * Default implementation of the `CipherFormConfigService`. This service should suffice for most use cases, however
 * the admin console may need to provide a custom implementation to support admin/custom users who have access to
 * collections that are not part of their normal sync data.
 */
@Injectable()
export class DefaultCipherFormConfigService implements CipherFormConfigService {
  private policyService: PolicyService = inject(PolicyService);
  private organizationService: OrganizationService = inject(OrganizationService);
  private cipherService: CipherService = inject(CipherService);
  private folderService: FolderService = inject(FolderService);
  private collectionService: CollectionService = inject(CollectionService);
  private accountService = inject(AccountService);

  private activeUserId$ = this.accountService.activeAccount$.pipe(map((a) => a?.id));

  async buildConfig(
    mode: CipherFormMode,
    cipherId?: CipherId,
    cipherType?: CipherType,
  ): Promise<CipherFormConfig> {
    const activeUserId = await firstValueFrom(this.activeUserId$);

    const [organizations, collections, allowPersonalOwnership, folders, cipher] =
      await firstValueFrom(
        combineLatest([
          this.organizations$(activeUserId),
          this.collectionService.encryptedCollections$.pipe(
            switchMap((c) =>
              this.collectionService.decryptedCollections$.pipe(
                filter((d) => d.length === c.length), // Ensure all collections have been decrypted
              ),
            ),
          ),
          this.allowPersonalOwnership$,
          this.folderService.folders$(activeUserId).pipe(
            switchMap((f) =>
              this.folderService.folderViews$(activeUserId).pipe(
                filter((d) => d.length - 1 === f.length), // -1 for "No Folder" in folderViews$
              ),
            ),
          ),
          this.getCipher(cipherId),
        ]),
      );

    return {
      mode,
      cipherType: cipher?.type ?? cipherType ?? CipherType.Login,
      admin: false,
      allowPersonalOwnership,
      originalCipher: cipher,
      collections,
      organizations,
      folders,
    };
  }

  organizations$(userId: UserId) {
    return this.organizationService
      .organizations$(userId)
      .pipe(
        map((orgs) =>
          orgs.filter(
            (o) => o.isMember && o.enabled && o.status === OrganizationUserStatusType.Confirmed,
          ),
        ),
      );
  }

  private allowPersonalOwnership$ = this.policyService
    .policyAppliesToActiveUser$(PolicyType.PersonalOwnership)
    .pipe(map((p) => !p));

  private getCipher(id?: CipherId): Promise<Cipher | null> {
    if (id == null) {
      return Promise.resolve(null);
    }
    return this.cipherService.get(id);
  }
}
