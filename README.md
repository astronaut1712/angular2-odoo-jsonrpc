# angular2-odoorpc
OdooRPC for angular2

Migrate from [https://github.com/akretion/angular-odoo/blob/master/src/components/odoo/jsonRpc-service.js](https://github.com/akretion/angular-odoo/blob/master/src/components/odoo/jsonRpc-service.js)
+ Support Basic Authentication

## Installation

`npm install --save angular2-odoo-jsonrpc`

## Functions list

- `login(db, user, pass)`
- `logout(force)`
- `getDbList() // doesn't work with odoo >= 9.0`
- `searchRead(model, domain, fields)`
- `call(model, method, args, kwargs)`


## How to use

Import `OdooRPCService` into component

```typescript
import { Component } from '@angular/core';
import { OdooRPCService } from 'angular2-odoo-jsonrpc';
```

Add provider in app component

```typescript
@Component({
    ...
    providers: [OdooRPCService]
})
```

Initialize configuration in `constructor` of component

```typescript

export class OdooClientExampleComponent {

    constructor(odooRPC: OdooRPCService){
        this.odooRPC.init({
            odoo_server: "https://odoo-server-example",
            http_auth: "username:password" // optional
        });
        this.odooRPC.login('db_example', 'username', 'password').then(res => {
            console.log('login success');
        }).catch( err => {
            console.error('login failed', err);
        })
    }

    ...

}

```
