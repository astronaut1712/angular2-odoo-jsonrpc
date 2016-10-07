"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var core_1 = require("@angular/core");
var http_1 = require("@angular/http");
require("rxjs/add/operator/toPromise");
var Cookies = (function () {
    function Cookies() {
        this.session_id = null;
    }
    Cookies.prototype.delete_sessionId = function () {
        this.session_id = null;
        document.cookie = "session_id=; expires=Wed, 29 Jun 2016 00:00:00 UTC";
    };
    Cookies.prototype.get_sessionId = function () {
        return document
            .cookie.split("; ")
            .filter(function (x) { return x.indexOf("session_id") === 0; })
            .map(function (x) { return x.split("=")[1]; })
            .pop() || this.session_id || "";
    };
    Cookies.prototype.set_sessionId = function (val) {
        document.cookie = "session_id=" + val;
        this.session_id = val;
    };
    return Cookies;
}());
var OdooRPCService = (function () {
    function OdooRPCService(http) {
        this.http = http;
        this.uniq_id_counter = 0;
        this.shouldManageSessionId = false; // try without first
        this.context = JSON.parse(localStorage.getItem("user_context")) || { "lang": "en_US" };
        this.cookies = new Cookies();
    }
    OdooRPCService.prototype.buildRequest = function (url, params) {
        this.uniq_id_counter += 1;
        if (this.shouldManageSessionId) {
            params.session_id = this.cookies.get_sessionId();
        }
        var json_data = {
            jsonrpc: "2.0",
            method: "call",
            params: params,
        };
        this.headers = new http_1.Headers({
            "Content-Type": "application/json",
            "X-Openerp-Session-Id": this.cookies.get_sessionId(),
            "Authorization": "Basic " + btoa("" + this.http_auth)
        });
        return JSON.stringify({
            jsonrpc: "2.0",
            method: "call",
            params: params,
        });
    };
    OdooRPCService.prototype.handleOdooErrors = function (response) {
        response = response.json();
        if (!response.error) {
            return response.result;
        }
        var error = response.error;
        var errorObj = {
            title: "    ",
            message: "",
            fullTrace: error
        };
        if (error.code === 200 && error.message === "Odoo Server Error" && error.data.name === "werkzeug.exceptions.NotFound") {
            errorObj.title = "page_not_found";
            errorObj.message = "HTTP Error";
        }
        else if ((error.code === 100 && error.message === "Odoo Session Expired") ||
            (error.code === 300 && error.message === "OpenERP WebClient Error" && error.data.debug.match("SessionExpiredException")) // v7
        ) {
            errorObj.title = "session_expired";
            this.cookies.delete_sessionId();
        }
        else if ((error.message === "Odoo Server Error" && /FATAL:  database "(.+)" does not exist/.test(error.data.message))) {
            errorObj.title = "database_not_found";
            errorObj.message = error.data.message;
        }
        else if ((error.data.name === "openerp.exceptions.AccessError")) {
            errorObj.title = "AccessError";
            errorObj.message = error.data.message;
        }
        else {
            var split = ("" + error.data.fault_code).split("\n")[0].split(" -- ");
            if (split.length > 1) {
                error.type = split.shift();
                error.data.fault_code = error.data.fault_code.substr(error.type.length + 4);
            }
            if (error.code === 200 && error.type) {
                errorObj.title = error.type;
                errorObj.message = error.data.fault_code.replace(/\n/g, "<br />");
            }
            else {
                errorObj.title = error.message;
                errorObj.message = error.data.debug.replace(/\n/g, "<br />");
            }
        }
        return Promise.reject(errorObj);
    };
    OdooRPCService.prototype.handleHttpErrors = function (error) {
        return Promise.reject(error.message || error);
    };
    OdooRPCService.prototype.init = function (configs) {
        this.odoo_server = configs.odoo_server;
        this.http_auth = configs.http_auth || null;
    };
    OdooRPCService.prototype.setOdooServer = function (odoo_server) {
        this.odoo_server = odoo_server;
    };
    OdooRPCService.prototype.setHttpAuth = function (http_auth) {
        this.http_auth = http_auth;
    };
    OdooRPCService.prototype.sendRequest = function (url, params) {
        var options = this.buildRequest(url, params);
        return this.http.post(this.odoo_server + url, options, { headers: this.headers })
            .toPromise()
            .then(this.handleOdooErrors)
            .catch(this.handleHttpErrors);
    };
    OdooRPCService.prototype.getServerInfo = function () {
        return this.sendRequest("/web/webclient/version_info", {});
    };
    OdooRPCService.prototype.getSessionInfo = function () {
        return this.sendRequest("/web/session/get_session_info", {});
    };
    OdooRPCService.prototype.login = function (db, login, password) {
        var params = {
            db: db,
            login: login,
            password: password
        };
        var $this = this;
        return this.sendRequest("/web/session/authenticate", params).then(function (result) {
            if (!result.uid) {
                $this.cookies.delete_sessionId();
                return Promise.reject({
                    title: "wrong_login",
                    message: "Username and password don't match",
                    fullTrace: result
                });
            }
            $this.context = result.user_context;
            localStorage.setItem("user_context", JSON.stringify($this.context));
            $this.cookies.set_sessionId(result.session_id);
            return result;
        });
    };
    OdooRPCService.prototype.isLoggedIn = function (force) {
        var _this = this;
        if (force === void 0) { force = true; }
        if (!force) {
            return Promise.resolve(this.cookies.get_sessionId().length > 0);
        }
        return this.getSessionInfo().then(function (result) {
            _this.cookies.set_sessionId(result.session_id);
            return !!(result.uid);
        });
    };
    OdooRPCService.prototype.logout = function (force) {
        var _this = this;
        if (force === void 0) { force = true; }
        this.cookies.delete_sessionId();
        if (force) {
            return this.getSessionInfo().then(function (r) {
                if (r.db)
                    return _this.login(r.db, "", "");
            });
        }
        else {
            return Promise.resolve();
        }
    };
    OdooRPCService.prototype.getDbList = function () {
        return this.sendRequest("/web/database/get_list", {});
    };
    OdooRPCService.prototype.searchRead = function (model, domain, fields) {
        var params = {
            model: model,
            domain: domain,
            fields: fields,
            context: this.context
        };
        return this.sendRequest("/web/dataset/search_read", params);
    };
    OdooRPCService.prototype.updateContext = function (context) {
        var _this = this;
        localStorage.setItem("user_context", JSON.stringify(context));
        var args = [[this.context.uid], context];
        this.call("res.users", "write", args, {})
            .then(function () { return _this.context = context; })
            .catch(function (err) { return _this.context = context; });
    };
    OdooRPCService.prototype.getContext = function () {
        return this.context;
    };
    OdooRPCService.prototype.call = function (model, method, args, kwargs) {
        kwargs = kwargs || {};
        kwargs.context = kwargs.context || {};
        Object.assign(kwargs.context, this.context);
        var params = {
            model: model,
            method: method,
            args: args,
            kwargs: kwargs,
        };
        return this.sendRequest("/web/dataset/call_kw", params);
    };
    OdooRPCService = __decorate([
        core_1.Injectable(),
        __param(0, core_1.Inject(http_1.Http))
    ], OdooRPCService);
    return OdooRPCService;
}());
exports.OdooRPCService = OdooRPCService;
