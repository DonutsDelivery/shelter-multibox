(function() {
    var LOG = "[Multibox]";
    var _styleEl = null;
    var _container = null;
    var _outsideClick = null;
    var _retryTimer = null;
    var _loginTokenFn = null;

    return {
        onLoad() {
            var store = shelter.plugin.store;

            // --- Token read: just use shelter's flux store (confirmed working) ---
            function getToken() {
                try {
                    return shelter.flux.storesFlat.AuthenticationStore.getToken();
                } catch (e) {
                    console.warn(LOG, "getToken failed:", e);
                    return null;
                }
            }

            function getCurrentUser() {
                try {
                    return shelter.flux.storesFlat.UserStore.getCurrentUser();
                } catch (e) { return null; }
            }

            // --- Find Discord's internal loginToken via webpack ---
            try {
                var wp = document.defaultView.webpackChunkdiscord_app;
                if (wp) {
                    wp.push([[Symbol()], {}, function(req) {
                        var mods = Object.values(req.c || {});
                        for (var i = 0; i < mods.length; i++) {
                            var ex = mods[i] && mods[i].exports;
                            if (!ex) continue;
                            // Check default.loginToken
                            if (ex.default && typeof ex.default.loginToken === "function") {
                                _loginTokenFn = ex.default.loginToken.bind(ex.default);
                                break;
                            }
                            // Check Z.loginToken (named export)
                            var keys = Object.keys(ex);
                            for (var k = 0; k < keys.length; k++) {
                                var val = ex[keys[k]];
                                if (val && typeof val.loginToken === "function") {
                                    _loginTokenFn = val.loginToken.bind(val);
                                    break;
                                }
                            }
                            if (_loginTokenFn) break;
                        }
                    }]);
                    wp.pop();
                }
            } catch (e) {
                console.warn(LOG, "webpack loginToken scan failed:", e);
            }

            console.log(LOG, "loginToken found:", !!_loginTokenFn);

            // --- Switch account ---
            function switchAccount(token) {
                if (_loginTokenFn) {
                    // Best path: Discord's own login function, no reload needed
                    console.log(LOG, "Switching via loginToken()");
                    _loginTokenFn(token);
                    return;
                }
                // Fallback: iframe localStorage write + reload
                console.log(LOG, "Switching via localStorage fallback");
                try {
                    var iframe = document.createElement("iframe");
                    iframe.style.display = "none";
                    document.body.appendChild(iframe);
                    iframe.contentWindow.localStorage.setItem("token", JSON.stringify(token));
                    document.body.removeChild(iframe);
                } catch (e) {
                    console.error(LOG, "iframe setToken failed:", e);
                    return;
                }
                try {
                    document.defaultView.location.reload();
                } catch (e) {
                    console.error(LOG, "reload failed:", e);
                }
            }

            // --- Helpers ---
            function getAvatarUrl(account) {
                if (!account.avatar) {
                    return "https://cdn.discordapp.com/embed/avatars/" + (Number(BigInt(account.id) >> 22n) % 6) + ".png";
                }
                return "https://cdn.discordapp.com/avatars/" + account.id + "/" + account.avatar + ".png?size=32";
            }

            function saveAccount(token, user) {
                var accs = JSON.parse(JSON.stringify(store.accounts || []));
                var idx = -1;
                for (var i = 0; i < accs.length; i++) {
                    if (accs[i].id === user.id) { idx = i; break; }
                }
                var entry = { id: user.id, username: user.username, avatar: user.avatar, token: token };
                if (idx >= 0) accs[idx] = entry;
                else accs.push(entry);
                store.accounts = accs;
                console.log(LOG, "Saved:", user.username, "| Total:", accs.length);
            }

            // --- CSS ---
            var css = [
                "#multibox-switcher{position:fixed;bottom:56px;left:78px;z-index:2147483646}",
                "#multibox-btn{width:36px;height:36px;border-radius:50%;border:2px solid var(--brand-500);background:var(--background-secondary);cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;transition:transform .15s,box-shadow .15s}",
                "#multibox-btn:hover{transform:scale(1.1);box-shadow:0 2px 8px rgba(0,0,0,.3)}",
                "#multibox-btn img{width:28px;height:28px;border-radius:50%;pointer-events:none}",
                "#multibox-popup{display:none;position:absolute;bottom:44px;left:0;background:var(--background-floating);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.3);padding:8px;min-width:200px;max-width:280px}",
                "#multibox-popup.open{display:block}",
                ".mbx-row{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;transition:background .1s}",
                ".mbx-row:hover{background:var(--background-modifier-hover)}",
                ".mbx-row.active{background:var(--background-modifier-selected);cursor:default}",
                ".mbx-row img{width:28px;height:28px;border-radius:50%;flex-shrink:0;pointer-events:none}",
                ".mbx-name{flex:1;color:var(--text-normal);font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
                ".mbx-badge{font-size:10px;color:var(--text-positive);font-weight:600;flex-shrink:0}",
                ".mbx-rm{color:var(--text-muted);cursor:pointer;font-size:16px;padding:0 2px;opacity:.5;flex-shrink:0;background:none;border:none}",
                ".mbx-rm:hover{opacity:1;color:var(--text-danger)}",
                ".mbx-save{width:100%;padding:6px;border-radius:4px;border:1px dashed var(--text-muted);background:transparent;color:var(--text-muted);cursor:pointer;font-size:12px;margin-top:4px}",
                ".mbx-save:hover{border-color:var(--brand-500);color:var(--brand-500)}",
                ".mbx-divider{height:1px;background:var(--background-modifier-accent);margin:4px 0}"
            ].join(" ");

            _styleEl = document.createElement("style");
            _styleEl.textContent = css;
            document.head.appendChild(_styleEl);

            // --- UI ---
            _container = document.createElement("div");
            _container.id = "multibox-switcher";

            function renderSwitcher() {
                var accounts = [];
                try { accounts = JSON.parse(JSON.stringify(store.accounts || [])); } catch (e) {}
                var cur = getCurrentUser();

                _container.innerHTML = "";

                var popup = document.createElement("div");
                popup.id = "multibox-popup";

                for (var i = 0; i < accounts.length; i++) {
                    (function(account) {
                        var isActive = cur && cur.id === account.id;
                        var row = document.createElement("div");
                        row.className = "mbx-row" + (isActive ? " active" : "");

                        var av = document.createElement("img");
                        av.src = getAvatarUrl(account);
                        row.appendChild(av);

                        var nm = document.createElement("span");
                        nm.className = "mbx-name";
                        nm.textContent = account.username;
                        row.appendChild(nm);

                        if (isActive) {
                            var badge = document.createElement("span");
                            badge.className = "mbx-badge";
                            badge.textContent = "ACTIVE";
                            row.appendChild(badge);
                        }

                        var rm = document.createElement("button");
                        rm.className = "mbx-rm";
                        rm.textContent = "\u00d7";
                        rm.addEventListener("click", function(e) {
                            e.stopPropagation();
                            var filtered = [];
                            var all = store.accounts || [];
                            for (var j = 0; j < all.length; j++) {
                                if (all[j].id !== account.id) filtered.push(all[j]);
                            }
                            store.accounts = filtered;
                            renderSwitcher();
                            var p = document.getElementById("multibox-popup");
                            if (p) p.classList.add("open");
                        });
                        row.appendChild(rm);

                        if (!isActive) {
                            row.addEventListener("click", function() {
                                switchAccount(account.token);
                            });
                        }

                        popup.appendChild(row);
                    })(accounts[i]);
                }

                if (accounts.length > 0) {
                    var div = document.createElement("div");
                    div.className = "mbx-divider";
                    popup.appendChild(div);
                }

                var saveBtn = document.createElement("button");
                saveBtn.className = "mbx-save";
                saveBtn.textContent = "+ Save Current Account";
                saveBtn.addEventListener("click", function(e) {
                    e.stopPropagation();
                    var t = getToken();
                    var u = getCurrentUser();
                    if (t && u) {
                        saveAccount(t, u);
                        renderSwitcher();
                        var p = document.getElementById("multibox-popup");
                        if (p) p.classList.add("open");
                    } else {
                        console.warn(LOG, "Cannot save - token:", !!t, "user:", !!u);
                    }
                });
                popup.appendChild(saveBtn);

                var btn = document.createElement("button");
                btn.id = "multibox-btn";
                btn.title = "Switch Account (Multibox)";
                if (cur) {
                    var img = document.createElement("img");
                    img.src = getAvatarUrl({ id: cur.id, avatar: cur.avatar });
                    btn.appendChild(img);
                } else {
                    btn.textContent = "\uD83D\uDC64";
                }
                btn.addEventListener("click", function(e) {
                    e.stopPropagation();
                    popup.classList.toggle("open");
                });

                _container.appendChild(popup);
                _container.appendChild(btn);
            }

            // Auto-save current account on load
            var token = getToken();
            var user = getCurrentUser();
            if (token && user) {
                saveAccount(token, user);
            } else {
                console.log(LOG, "Not ready yet, will retry. token:", !!token, "user:", !!user);
                _retryTimer = setInterval(function() {
                    var t = getToken();
                    var u = getCurrentUser();
                    if (t && u) {
                        saveAccount(t, u);
                        renderSwitcher();
                        clearInterval(_retryTimer);
                        _retryTimer = null;
                        console.log(LOG, "Retry succeeded");
                    }
                }, 2000);
            }

            renderSwitcher();
            document.body.appendChild(_container);

            // Close popup on outside click
            _outsideClick = function(e) {
                if (_container && _container.contains(e.target)) return;
                var p = document.getElementById("multibox-popup");
                if (p) p.classList.remove("open");
            };
            document.addEventListener("click", _outsideClick);

            console.log(LOG, "Loaded OK -", (store.accounts || []).length, "saved accounts");
        },

        onUnload() {
            try { if (_container && _container.parentNode) _container.parentNode.removeChild(_container); } catch (e) {}
            try { if (_styleEl && _styleEl.parentNode) _styleEl.parentNode.removeChild(_styleEl); } catch (e) {}
            try { if (_outsideClick) document.removeEventListener("click", _outsideClick); } catch (e) {}
            try { if (_retryTimer) clearInterval(_retryTimer); } catch (e) {}
            _container = null;
            _styleEl = null;
            _outsideClick = null;
            _retryTimer = null;
            _loginTokenFn = null;
            console.log(LOG, "Unloaded");
        },

        settings() {
            var html = shelter.solidH.html;
            return html`
                <div style="color:var(--text-muted);font-size:14px;">
                    <p style="margin:0 0 8px 0;">Click the floating avatar button near the bottom-left corner.</p>
                    <p style="margin:0;">Save accounts, then one-click to switch between them.</p>
                </div>
            `;
        }
    };
})()