'use strict';

var locksmithServices = angular.module('locksmithServices', ['ngResource']);

locksmithServices.factory('Bookmark', ['$resource', function($resource) {
    if (window.settings.use_local_storage) {
        return {
            'get': function() {},
            'create': function() {},
            'update': function() {},
            'query': function(options) {
                if (typeof options === 'undefined') {
                    var options = {};
                }

                if (typeof options['bookmarkId'] !== 'undefined') {
                    var bookmark = window.settings.bookmarks[options['bookmarkId']];
                    if (typeof bookmark === 'undefined') {
                        bookmark = {};
                    }
                    bookmark.id = options['bookmarkId'];
                    bookmark.$update = function() {
                        window.settings.bookmarks[options['bookmarkId']] = bookmark;
                    };
                    bookmark.$create = function() {
                        window.settings.bookmarks.push(bookmark);
                    };
                    bookmark.$delete = function() {
                        if (typeof bookmark.id !== 'undefined') {
                            window.settings.bookmarks.splice(bookmark.id, 1);
                        }
                    };
                    return bookmark;
                } else {
                    return {
                        bookmarks: jQuery.map(
                            window.settings.bookmarks,
                            function(bookmark, id) {
                                bookmark.id = id;
                                return bookmark;
                            }
                        )
                    };
                }
            },
            'remove': function() {},
            'delete': function() {}
        };
    } else {
        return $resource(
            window.settings.api + '/v1/bookmarks/:bookmarkId', {
                bookmarkId: '@id'
            }, {
                'get': {
                    method: 'GET',
                    headers: {
                        authorization: 'Basic ' + btoa(window.settings.api_username + ':' + window.settings.api_password)
                    }
                },
                'create': {
                    method: 'POST',
                    headers: {
                        authorization: 'Basic ' + btoa(window.settings.api_username + ':' + window.settings.api_password)
                    }
                },
                'update': {
                    method: 'PUT',
                    headers: {
                        authorization: 'Basic ' + btoa(window.settings.api_username + ':' + window.settings.api_password)
                    }
                },
                'query': {
                    method: 'GET',
                    isArray: false,
                    headers: {
                        authorization: 'Basic ' + btoa(window.settings.api_username + ':' + window.settings.api_password)
                    }
                },
                'remove': {
                    method: 'DELETE',
                    headers: {
                        authorization: 'Basic ' + btoa(window.settings.api_username + ':' + window.settings.api_password)
                    }
                },
                'delete': {
                    method: 'DELETE',
                    headers: {
                        authorization: 'Basic ' + btoa(window.settings.api_username + ':' + window.settings.api_password)
                    }
                }
            }
        );
    }
}]);

locksmithServices.factory('Account', ['$resource', '$http', function($resource, $http) {
    return $resource(
        window.settings.api + '/v1/accounts/:accountId', {
            accountId: '@id'
        }, {
            'get': {
                method: 'GET',
                headers: {
                    authorization: 'Basic ' + btoa(window.settings.api_username + ':' + window.settings.api_password)
                }
            },
            'create': {
                method: 'POST',
                headers: {
                    authorization: 'Basic ' + btoa(window.settings.api_username + ':' + window.settings.api_password)
                }
            },
            'update': {
                method: 'PUT',
                headers: {
                    authorization: 'Basic ' + btoa(window.settings.api_username + ':' + window.settings.api_password)
                }
            },
            'query': {
                method: 'GET',
                isArray: false,
                headers: {
                    authorization: 'Basic ' + btoa(window.settings.api_username + ':' + window.settings.api_password)
                }
            },
            'remove': {
                method: 'DELETE',
                headers: {
                    authorization: 'Basic ' + btoa(window.settings.api_username + ':' + window.settings.api_password)
                }
            },
            'delete': {
                method: 'DELETE',
                headers: {
                    authorization: 'Basic ' + btoa(window.settings.api_username + ':' + window.settings.api_password)
                }
            }
        }
    );
}]);

locksmithServices.factory('signin', ['$q', '$http', '$location', function($q, $http, $location) {
    var signin = {};

    signin.assumeRole = function(bookmark, token_code) {
        var deferred = $q.defer();

        setTimeout(function() {
            if (window.settings.use_switch_role) {
                var request_url = "https://signin.aws.amazon.com/switchrole";

                request_url += "?account=";
                request_url += encodeURIComponent(bookmark.account_number);
                request_url += "&roleName=";
                request_url += encodeURIComponent(bookmark.role_name);
                request_url += "&displayName=";
                request_url += encodeURIComponent(bookmark.name);

                signin.open(request_url);

                deferred.resolve();
            } else {
                var credentials = {
                    accessKeyId: window.settings.aws_access_key_id,
                    secretAccessKey: window.settings.aws_secret_access_key
                };

                var params = {
                    RoleArn: 'arn:aws:iam::' + bookmark.account_number + ':role/' + bookmark.role_name,
                    RoleSessionName: 'AssumeRoleSession'
                };

                if (token_code) {
                    params['SerialNumber'] = window.settings.mfa_serial_number;
                    params['TokenCode'] = token_code;
                }

                var sts = new AWS.STS(credentials);
                sts.assumeRole(params, function(err, data) {
                    if (err) {
                        deferred.reject(err);
                    } else {
                        signin.getSigninToken(
                            data.Credentials.AccessKeyId,
                            data.Credentials.SecretAccessKey,
                            data.Credentials.SessionToken
                        );
                        deferred.resolve();
                    }
                });
            }
        }, 0);

        return deferred.promise;
    };

    signin.getSigninToken = function(access_key_id, secret_access_key, session_token) {
        var temp_credentials = {
            sessionId: access_key_id,
            sessionKey: secret_access_key,
            sessionToken: session_token
        };

        var request_parameters = "?Action=getSigninToken";
        request_parameters += "&SessionDuration=" + 3600 * 4;
        request_parameters += "&Session=";
        request_parameters += encodeURIComponent(JSON.stringify(temp_credentials));

        var request_url;
        if (
            (window.chrome && chrome.runtime && chrome.runtime.id) ||
            (window.safari && safari.application)
        ) {
            // Running as Chrome/Safari Extension
            request_url = "https://signin.aws.amazon.com/federation";
        } else {
            // Running in Browser
            request_url = "https://kw25v8ctc2.execute-api.eu-central-1.amazonaws.com/federation";
        }
        request_url += request_parameters;

        // startJob();
        $http.get(request_url).success(function(data) {
            // stopJob();
            signin.redirect(data.SigninToken);
        });
    };

    signin.redirect = function(signinToken) {
        var request_parameters = "?Action=login";
        request_parameters += "&Issuer=";
        request_parameters += "&Destination=";
        request_parameters += encodeURIComponent("https://console.aws.amazon.com/?region=eu-west-1");
        request_parameters += "&SigninToken=" + encodeURIComponent(signinToken);

        var request_url = "https://signin.aws.amazon.com/federation";
        request_url += request_parameters;

        signin.open(request_url);
    };

    signin.open = function(url) {
        if (window.chrome && chrome.runtime && chrome.runtime.id) {
            chrome.windows.create({
                url: url,
                incognito: window.settings.incognito_sessions
            });
        } else if (window.safari && safari.application) {
            var tab = safari.application.openBrowserWindow().activeTab;
            tab.url = url;
        } else {
            window.location.href = url;
        }
    };

    return signin;
}]);
