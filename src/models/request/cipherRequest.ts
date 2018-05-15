import { CipherType } from 'jslib/enums/cipherType';

import { LoginRequest } from './loginRequest';
import { SecureNoteRequest } from './secureNoteRequest';
import { CardRequest } from './cardRequest';
import { IdentityRequest } from './identityRequest';
import { FieldRequest } from './fieldRequest';

import { CipherView } from 'jslib/models/view/cipherView';

export class CipherRequest {
    static template(): CipherRequest {
        var req = new CipherRequest();
        req.type = CipherType.Login;
        req.folderId = null;
        req.organizationId = null;
        req.name = 'Item name';
        req.notes = 'Some notes about this item.';
        req.favorite = false;
        req.fields = [];
        req.login = null;
        req.secureNote = null;
        req.card = null;
        req.identity = null;
        return req;
    }

    static toView(req: CipherRequest) {
        const view = new CipherView();
        view.name = req.name;
        return view;
    }

    type: CipherType;
    folderId: string;
    organizationId: string;
    name: string;
    notes: string;
    favorite: boolean;
    fields: FieldRequest[];
    login: LoginRequest;
    secureNote: SecureNoteRequest;
    card: CardRequest;
    identity: IdentityRequest;
}
