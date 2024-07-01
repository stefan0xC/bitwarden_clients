import { Component, ViewChild, ViewContainerRef } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import {
  combineLatest,
  concatMap,
  firstValueFrom,
  from,
  lastValueFrom,
  map,
  Observable,
  shareReplay,
  switchMap,
} from "rxjs";

import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ModalService } from "@bitwarden/angular/services/modal.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationManagementPreferencesService } from "@bitwarden/common/admin-console/abstractions/organization-management-preferences/organization-management-preferences.service";
import { OrganizationUserService } from "@bitwarden/common/admin-console/abstractions/organization-user/organization-user.service";
import { OrganizationUserConfirmRequest } from "@bitwarden/common/admin-console/abstractions/organization-user/requests";
import { OrganizationUserUserDetailsResponse } from "@bitwarden/common/admin-console/abstractions/organization-user/responses";
import { PolicyApiServiceAbstraction as PolicyApiService } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import {
  OrganizationUserStatusType,
  OrganizationUserType,
  PolicyType,
} from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { OrganizationKeysRequest } from "@bitwarden/common/admin-console/models/request/organization-keys.request";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billilng-api.service.abstraction";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CollectionData } from "@bitwarden/common/vault/models/data/collection.data";
import { Collection } from "@bitwarden/common/vault/models/domain/collection";
import { CollectionDetailsResponse } from "@bitwarden/common/vault/models/response/collection.response";
import { DialogService, SimpleDialogOptions } from "@bitwarden/components";

import { openEntityEventsDialog } from "../../../admin-console/organizations/manage/entity-events.component";
import { NewBasePeopleComponent } from "../../common/new-base.people.component";
import { GroupService } from "../core";
import { OrganizationUserView } from "../core/views/organization-user.view";

import { BulkConfirmComponent } from "./components/bulk/bulk-confirm.component";
import { BulkEnableSecretsManagerDialogComponent } from "./components/bulk/bulk-enable-sm-dialog.component";
import { BulkRemoveComponent } from "./components/bulk/bulk-remove.component";
import { BulkRestoreRevokeComponent } from "./components/bulk/bulk-restore-revoke.component";
import { BulkStatusComponent } from "./components/bulk/bulk-status.component";
import {
  MemberDialogResult,
  MemberDialogTab,
  openUserAddEditDialog,
} from "./components/member-dialog";
import { ResetPasswordComponent } from "./components/reset-password.component";

@Component({
  selector: "app-org-people",
  templateUrl: "people.component.html",
})
export class PeopleComponent extends NewBasePeopleComponent<OrganizationUserView> {
  @ViewChild("groupsTemplate", { read: ViewContainerRef, static: true })
  groupsModalRef: ViewContainerRef;
  @ViewChild("confirmTemplate", { read: ViewContainerRef, static: true })
  confirmModalRef: ViewContainerRef;
  @ViewChild("resetPasswordTemplate", { read: ViewContainerRef, static: true })
  resetPasswordModalRef: ViewContainerRef;
  @ViewChild("bulkStatusTemplate", { read: ViewContainerRef, static: true })
  bulkStatusModalRef: ViewContainerRef;
  @ViewChild("bulkConfirmTemplate", { read: ViewContainerRef, static: true })
  bulkConfirmModalRef: ViewContainerRef;
  @ViewChild("bulkRemoveTemplate", { read: ViewContainerRef, static: true })
  bulkRemoveModalRef: ViewContainerRef;

  userType = OrganizationUserType;
  userStatusType = OrganizationUserStatusType;
  memberTab = MemberDialogTab;

  organization: Organization;
  status: OrganizationUserStatusType = null;
  orgResetPasswordPolicyEnabled = false;
  orgIsOnSecretsManagerStandalone = false;

  protected canUseSecretsManager$: Observable<boolean>;

  // Fixed sizes used for cdkVirtualScroll
  protected rowHeight = 62;
  protected rowHeightClass = `tw-h-[62px]`;

  constructor(
    apiService: ApiService,
    private route: ActivatedRoute,
    i18nService: I18nService,
    modalService: ModalService,
    platformUtilsService: PlatformUtilsService,
    cryptoService: CryptoService,
    validationService: ValidationService,
    private policyService: PolicyService,
    private policyApiService: PolicyApiService,
    logService: LogService,
    userNamePipe: UserNamePipe,
    private syncService: SyncService,
    private organizationService: OrganizationService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private organizationUserService: OrganizationUserService,
    dialogService: DialogService,
    private router: Router,
    private groupService: GroupService,
    private collectionService: CollectionService,
    organizationManagementPreferencesService: OrganizationManagementPreferencesService,
    private billingApiService: BillingApiServiceAbstraction,
  ) {
    super(
      apiService,
      i18nService,
      platformUtilsService,
      cryptoService,
      validationService,
      modalService,
      logService,
      userNamePipe,
      dialogService,
      organizationManagementPreferencesService,
    );

    const organization$ = this.route.params.pipe(
      concatMap((params) => this.organizationService.get$(params.organizationId)),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    this.canUseSecretsManager$ = organization$.pipe(map((org) => org.useSecretsManager));

    const policies$ = organization$.pipe(
      switchMap((organization) => {
        if (organization.isProviderUser) {
          return from(this.policyApiService.getPolicies(organization.id)).pipe(
            map((response) => Policy.fromListResponse(response)),
          );
        }

        return this.policyService.policies$;
      }),
    );

    combineLatest([this.route.queryParams, policies$, organization$])
      .pipe(
        concatMap(async ([qParams, policies, organization]) => {
          this.organization = organization;

          // Backfill pub/priv key if necessary
          if (
            this.organization.canManageUsersPassword &&
            !this.organization.hasPublicAndPrivateKeys
          ) {
            const orgShareKey = await this.cryptoService.getOrgKey(this.organization.id);
            const orgKeys = await this.cryptoService.makeKeyPair(orgShareKey);
            const request = new OrganizationKeysRequest(orgKeys[0], orgKeys[1].encryptedString);
            const response = await this.organizationApiService.updateKeys(
              this.organization.id,
              request,
            );
            if (response != null) {
              this.organization.hasPublicAndPrivateKeys =
                response.publicKey != null && response.privateKey != null;
              await this.syncService.fullSync(true); // Replace organizations with new data
            } else {
              throw new Error(this.i18nService.t("resetPasswordOrgKeysError"));
            }
          }

          const resetPasswordPolicy = policies
            .filter((policy) => policy.type === PolicyType.ResetPassword)
            .find((p) => p.organizationId === this.organization.id);
          this.orgResetPasswordPolicyEnabled = resetPasswordPolicy?.enabled;

          this.orgIsOnSecretsManagerStandalone = false; // don't get billing metadata

          await this.load();

          this.searchControl.setValue(qParams.search);

          if (qParams.viewEvents != null) {
            const user = this.dataSource.data.filter((u) => u.id === qParams.viewEvents);
            if (user.length > 0 && user[0].status === OrganizationUserStatusType.Confirmed) {
              this.openEventsDialog(user[0]);
            }
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  async getUsers(): Promise<OrganizationUserView[]> {
    let groupsPromise: Promise<Map<string, string>>;
    let collectionsPromise: Promise<Map<string, string>>;

    // We don't need both groups and collections for the table, so only load one
    const userPromise = this.organizationUserService.getAllUsers(this.organization.id, {
      includeGroups: this.organization.useGroups,
      includeCollections: !this.organization.useGroups,
    });

    // Depending on which column is displayed, we need to load the group/collection names
    if (this.organization.useGroups) {
      groupsPromise = this.getGroupNameMap();
    } else {
      collectionsPromise = this.getCollectionNameMap();
    }

    const [usersResponse, groupNamesMap, collectionNamesMap] = await Promise.all([
      userPromise,
      groupsPromise,
      collectionsPromise,
    ]);

    return usersResponse.data?.map<OrganizationUserView>((r) => {
      const userView = OrganizationUserView.fromResponse(r);

      userView.groupNames = userView.groups
        .map((g) => groupNamesMap.get(g))
        .sort(this.i18nService.collator?.compare);
      userView.collectionNames = userView.collections
        .map((c) => collectionNamesMap.get(c.id))
        .sort(this.i18nService.collator?.compare);

      return userView;
    });
  }

  async getGroupNameMap(): Promise<Map<string, string>> {
    const groups = await this.groupService.getAll(this.organization.id);
    const groupNameMap = new Map<string, string>();
    groups.forEach((g) => groupNameMap.set(g.id, g.name));
    return groupNameMap;
  }

  /**
   * Retrieve a map of all collection IDs <-> names for the organization.
   */
  async getCollectionNameMap() {
    const collectionMap = new Map<string, string>();
    const response = await this.apiService.getCollections(this.organization.id);

    const collections = response.data.map(
      (r) => new Collection(new CollectionData(r as CollectionDetailsResponse)),
    );
    const decryptedCollections = await this.collectionService.decryptMany(collections);

    decryptedCollections.forEach((c) => collectionMap.set(c.id, c.name));

    return collectionMap;
  }

  deleteUser(id: string): Promise<void> {
    return this.organizationUserService.deleteOrganizationUser(this.organization.id, id);
  }

  revokeUser(id: string): Promise<void> {
    return this.organizationUserService.revokeOrganizationUser(this.organization.id, id);
  }

  restoreUser(id: string): Promise<void> {
    return this.organizationUserService.restoreOrganizationUser(this.organization.id, id);
  }

  reinviteUser(id: string): Promise<void> {
    return this.organizationUserService.postOrganizationUserReinvite(this.organization.id, id);
  }

  async confirmUser(user: OrganizationUserView, publicKey: Uint8Array): Promise<void> {
    const orgKey = await this.cryptoService.getOrgKey(this.organization.id);
    const key = await this.cryptoService.rsaEncrypt(orgKey.key, publicKey);
    const request = new OrganizationUserConfirmRequest();
    request.key = key.encryptedString;
    await this.organizationUserService.postOrganizationUserConfirm(
      this.organization.id,
      user.id,
      request,
    );
  }

  allowResetPassword(orgUser: OrganizationUserView): boolean {
    // Hierarchy check
    let callingUserHasPermission = false;

    switch (this.organization.type) {
      case OrganizationUserType.Owner:
        callingUserHasPermission = true;
        break;
      case OrganizationUserType.Admin:
        callingUserHasPermission = orgUser.type !== OrganizationUserType.Owner;
        break;
      case OrganizationUserType.Custom:
        callingUserHasPermission =
          orgUser.type !== OrganizationUserType.Owner &&
          orgUser.type !== OrganizationUserType.Admin;
        break;
    }

    // Final
    return (
      this.organization.canManageUsersPassword &&
      callingUserHasPermission &&
      this.organization.useResetPassword &&
      this.organization.hasPublicAndPrivateKeys &&
      orgUser.resetPasswordEnrolled &&
      this.orgResetPasswordPolicyEnabled &&
      orgUser.status === OrganizationUserStatusType.Confirmed
    );
  }

  showEnrolledStatus(orgUser: OrganizationUserUserDetailsResponse): boolean {
    return (
      this.organization.useResetPassword &&
      orgUser.resetPasswordEnrolled &&
      this.orgResetPasswordPolicyEnabled
    );
  }

  private getManageBillingText(): string {
    return this.organization.canEditSubscription ? "ManageBilling" : "NoManageBilling";
  }

  private getProductKey(productType: ProductTierType): string {
    let product = "";
    switch (productType) {
      case ProductTierType.Free:
        product = "freeOrg";
        break;
      case ProductTierType.TeamsStarter:
        product = "teamsStarterPlan";
        break;
      default:
        throw new Error(`Unsupported product type: ${productType}`);
    }
    return `${product}InvLimitReached${this.getManageBillingText()}`;
  }

  private getDialogContent(): string {
    return this.i18nService.t(
      this.getProductKey(this.organization.productTierType),
      this.organization.seats,
    );
  }

  private getAcceptButtonText(): string {
    if (!this.organization.canEditSubscription) {
      return this.i18nService.t("ok");
    }

    const productType = this.organization.productTierType;

    if (productType !== ProductTierType.Free && productType !== ProductTierType.TeamsStarter) {
      throw new Error(`Unsupported product type: ${productType}`);
    }

    return this.i18nService.t("upgrade");
  }

  private async handleDialogClose(result: boolean | undefined): Promise<void> {
    if (!result || !this.organization.canEditSubscription) {
      return;
    }

    const productType = this.organization.productTierType;

    if (productType !== ProductTierType.Free && productType !== ProductTierType.TeamsStarter) {
      throw new Error(`Unsupported product type: ${this.organization.productTierType}`);
    }

    await this.router.navigate(
      ["/organizations", this.organization.id, "billing", "subscription"],
      { queryParams: { upgrade: true } },
    );
  }

  private async showSeatLimitReachedDialog(): Promise<void> {
    const orgUpgradeSimpleDialogOpts: SimpleDialogOptions = {
      title: this.i18nService.t("upgradeOrganization"),
      content: this.getDialogContent(),
      type: "primary",
      acceptButtonText: this.getAcceptButtonText(),
    };

    if (!this.organization.canEditSubscription) {
      orgUpgradeSimpleDialogOpts.cancelButtonText = null;
    }

    const simpleDialog = this.dialogService.openSimpleDialogRef(orgUpgradeSimpleDialogOpts);
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    firstValueFrom(simpleDialog.closed).then(this.handleDialogClose.bind(this));
  }

  async edit(user: OrganizationUserView, initialTab: MemberDialogTab = MemberDialogTab.Role) {
    if (!user && this.organization.hasReseller && this.organization.seats === this.confirmedCount) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("seatLimitReached"),
        this.i18nService.t("contactYourProvider"),
      );
      return;
    }

    // Invite User: Add Flow
    // Click on user email: Edit Flow

    // User attempting to invite new users in a free org with max users
    if (
      !user &&
      this.allUsers.length === this.organization.seats &&
      (this.organization.productTierType === ProductTierType.Free ||
        this.organization.productTierType === ProductTierType.TeamsStarter)
    ) {
      // Show org upgrade modal
      await this.showSeatLimitReachedDialog();
      return;
    }

    const dialog = openUserAddEditDialog(this.dialogService, {
      data: {
        name: this.userNamePipe.transform(user),
        organizationId: this.organization.id,
        organizationUserId: user != null ? user.id : null,
        allOrganizationUserEmails: this.allUsers?.map((user) => user.email) ?? [],
        usesKeyConnector: user?.usesKeyConnector,
        isOnSecretsManagerStandalone: this.orgIsOnSecretsManagerStandalone,
        initialTab: initialTab,
        numConfirmedMembers: this.confirmedCount,
      },
    });

    const result = await lastValueFrom(dialog.closed);
    switch (result) {
      case MemberDialogResult.Deleted:
        this.removeUser(user);
        break;
      case MemberDialogResult.Saved:
      case MemberDialogResult.Revoked:
      case MemberDialogResult.Restored:
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.load();
        break;
    }
  }

  async bulkRemove() {
    if (this.actionPromise != null) {
      return;
    }

    const dialogRef = BulkRemoveComponent.open(this.dialogService, {
      data: {
        organizationId: this.organization.id,
        users: this.getCheckedUsers(),
      },
    });
    await lastValueFrom(dialogRef.closed);
    await this.load();
  }

  async bulkRevoke() {
    await this.bulkRevokeOrRestore(true);
  }

  async bulkRestore() {
    await this.bulkRevokeOrRestore(false);
  }

  async bulkRevokeOrRestore(isRevoking: boolean) {
    if (this.actionPromise != null) {
      return;
    }

    const ref = BulkRestoreRevokeComponent.open(this.dialogService, {
      organizationId: this.organization.id,
      users: this.getCheckedUsers(),
      isRevoking: isRevoking,
    });

    await firstValueFrom(ref.closed);
    await this.load();
  }

  async bulkReinvite() {
    if (this.actionPromise != null) {
      return;
    }

    const users = this.getCheckedUsers();
    const filteredUsers = users.filter((u) => u.status === OrganizationUserStatusType.Invited);

    if (filteredUsers.length <= 0) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("noSelectedUsersApplicable"),
      );
      return;
    }

    try {
      const response = this.organizationUserService.postManyOrganizationUserReinvite(
        this.organization.id,
        filteredUsers.map((user) => user.id),
      );
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises

      // Bulk Status component open
      const dialogRef = BulkStatusComponent.open(this.dialogService, {
        data: {
          users: users,
          filteredUsers: filteredUsers,
          request: response,
          successfullMessage: this.i18nService.t("bulkReinviteMessage"),
        },
      });
      await lastValueFrom(dialogRef.closed);
    } catch (e) {
      this.validationService.showError(e);
    }
    this.actionPromise = null;
  }

  async bulkConfirm() {
    if (this.actionPromise != null) {
      return;
    }

    const dialogRef = BulkConfirmComponent.open(this.dialogService, {
      data: {
        organizationId: this.organization.id,
        users: this.getCheckedUsers(),
      },
    });

    await lastValueFrom(dialogRef.closed);
    await this.load();
  }

  async bulkEnableSM() {
    const users = this.getCheckedUsers().filter((ou) => !ou.accessSecretsManager);

    if (users.length === 0) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("noSelectedUsersApplicable"),
      );
      return;
    }

    const dialogRef = BulkEnableSecretsManagerDialogComponent.open(this.dialogService, {
      orgId: this.organization.id,
      users,
    });

    await lastValueFrom(dialogRef.closed);
    this.selectAll(false);
    await this.load();
  }

  openEventsDialog(user: OrganizationUserView) {
    openEntityEventsDialog(this.dialogService, {
      data: {
        name: this.userNamePipe.transform(user),
        organizationId: this.organization.id,
        entityId: user.id,
        showUser: false,
        entity: "user",
      },
    });
  }

  async resetPassword(user: OrganizationUserView) {
    const [modal] = await this.modalService.openViewRef(
      ResetPasswordComponent,
      this.resetPasswordModalRef,
      (comp) => {
        comp.name = this.userNamePipe.transform(user);
        comp.email = user != null ? user.email : null;
        comp.organizationId = this.organization.id;
        comp.id = user != null ? user.id : null;

        // eslint-disable-next-line rxjs-angular/prefer-takeuntil
        comp.onPasswordReset.subscribe(() => {
          modal.close();
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.load();
        });
      },
    );
  }

  protected async removeUserConfirmationDialog(user: OrganizationUserView) {
    const content = user.usesKeyConnector
      ? "removeUserConfirmationKeyConnector"
      : "removeOrgUserConfirmation";

    const confirmed = await this.dialogService.openSimpleDialog({
      title: {
        key: "removeUserIdAccess",
        placeholders: [this.userNamePipe.transform(user)],
      },
      content: { key: content },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    if (user.status > OrganizationUserStatusType.Invited && user.hasMasterPassword === false) {
      return await this.noMasterPasswordConfirmationDialog(user);
    }

    return true;
  }

  protected async revokeUserConfirmationDialog(user: OrganizationUserView) {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "revokeAccess", placeholders: [this.userNamePipe.transform(user)] },
      content: this.revokeWarningMessage(),
      acceptButtonText: { key: "revokeAccess" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    if (user.status > OrganizationUserStatusType.Invited && user.hasMasterPassword === false) {
      return await this.noMasterPasswordConfirmationDialog(user);
    }

    return true;
  }

  private async noMasterPasswordConfirmationDialog(user: OrganizationUserView) {
    return this.dialogService.openSimpleDialog({
      title: {
        key: "removeOrgUserNoMasterPasswordTitle",
      },
      content: {
        key: "removeOrgUserNoMasterPasswordDesc",
        placeholders: [this.userNamePipe.transform(user)],
      },
      type: "warning",
    });
  }
}
