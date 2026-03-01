({
    onLoad() {
        try {
            var LOG = "[Multibox]";
            var store = shelter.plugin.store;

            function getToken() {
                var raw = window.localStorage.getItem("token");
                return raw ? raw.replace(/^"|"$/g, "") : null;
            }

            function getCurrentUser() {
                try {
                    var UserStore = shelter.flux.storesFlat.UserStore;
                    return UserStore && UserStore.getCurrentUser && UserStore.getCurrentUser();
                } catch (e) { return null; }
            }

            function getAvatarUrl(account) {
                if (!account.avatar) return "https://cdn.discordapp.com/embed/avatars/" + (Number(BigInt(account.id) >> 22n) % 6) + ".png";
                return "https://cdn.discordapp.com/avatars/" + account.id + "/" + account.avatar + ".png?size=32";
            }

            function saveAccount(token, user) {
                var accs = JSON.parse(JSON.stringify(store.accounts || []));
                var idx = accs.findIndex(function (a) { return a.id === user.id; });
                var entry = { id: user.id, username: user.username, avatar: user.avatar, token: token };
                if (idx >= 0) accs[idx] = entry;
                else accs.push(entry);
                store.accounts = accs;
                console.log(LOG, "Saved account:", user.username, "| Total:", accs.length);
            }

            function switchTo(account) {
                window.localStorage.setItem("token", JSON.stringify(account.token));
                window.location.reload();
            }

            var self = this;

            // === Inject CSS ===
            var css = "#multibox-switcher{position:fixed;bottom:56px;left:78px;z-index:2147483646}"
                + "#multibox-btn{width:36px;height:36px;border-radius:50%;border:2px solid var(--brand-500);background:var(--background-secondary);cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;transition:transform .15s,box-shadow .15s}"
                + "#multibox-btn:hover{transform:scale(1.1);box-shadow:0 2px 8px rgba(0,0,0,.3)}"
                + "#multibox-btn img{width:28px;height:28px;border-radius:50%;pointer-events:none}"
                + "#multibox-popup{display:none;position:absolute;bottom:44px;left:0;background:var(--background-floating);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.3);padding:8px;min-width:200px;max-width:280px}"
                + "#multibox-popup.open{display:block}"
                + ".mbx-row{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;transition:background .1s}"
                + ".mbx-row:hover{background:var(--background-modifier-hover)}"
                + ".mbx-row.active{background:var(--background-modifier-selected);cursor:default}"
                + ".mbx-row img{width:28px;height:28px;border-radius:50%;flex-shrink:0;pointer-events:none}"
                + ".mbx-name{flex:1;color:var(--text-normal);font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
                + ".mbx-badge{font-size:10px;color:var(--text-positive);font-weight:600;flex-shrink:0}"
                + ".mbx-rm{color:var(--text-muted);cursor:pointer;font-size:16px;padding:0 2px;opacity:.5;flex-shrink:0;background:none;border:none}"
                + ".mbx-rm:hover{opacity:1;color:var(--text-danger)}"
                + ".mbx-save{width:100%;padding:6px;border-radius:4px;border:1px dashed var(--text-muted);background:transparent;color:var(--text-muted);cursor:pointer;font-size:12px;margin-top:4px}"
                + ".mbx-save:hover{border-color:var(--brand-500);color:var(--brand-500)}"
                + ".mbx-divider{height:1px;background:var(--background-modifier-accent);margin:4px 0}";

            var styleEl = document.createElement("style");
            styleEl.textContent = css;
            document.head.appendChild(styleEl);
            this._styleEl = styleEl;

            // === Build floating switcher DOM ===
            var container = document.createElement("div");
            container.id = "multibox-switcher";
            this._container = container;

            function renderSwitcher() {
                var accounts = store.accounts || [];
                try { accounts = JSON.parse(JSON.stringify(accounts)); } catch(e) { accounts = []; }
                var cur = getCurrentUser();

                container.innerHTML = "";

                var popup = document.createElement("div");
                popup.id = "multibox-popup";

                for (var i = 0; i < accounts.length; i++) {
                    (function(account) {
                        var isActive = cur && cur.id === account.id;
                        var row = document.createElement("div");
                        row.className = "mbx-row" + (isActive ? " active" : "");

                        var avatar = document.createElement("img");
                        avatar.src = getAvatarUrl(account);
                        row.appendChild(avatar);

                        var name = document.createElement("span");
                        name.className = "mbx-name";
                        name.textContent = account.username;
                        row.appendChild(name);

                        if (isActive) {
                            var badge = document.createElement("span");
                            badge.className = "mbx-badge";
                            badge.textContent = "ACTIVE";
                            row.appendChild(badge);
                        }

                        var rm = document.createElement("button");
                        rm.className = "mbx-rm";
                        rm.textContent = "\u00d7";
                        rm.addEventListener("click", function (e) {
                            e.stopPropagation();
                            var filtered = (store.accounts || []).filter(function (a) { return a.id !== account.id; });
                            store.accounts = filtered;
                            renderSwitcher();
                            var p = document.getElementById("multibox-popup");
                            if (p) p.classList.add("open");
                        });
                        row.appendChild(rm);

                        if (!isActive) {
                            row.addEventListener("click", function () { switchTo(account); });
                        }

                        popup.appendChild(row);
                    })(accounts[i]);
                }

                if (accounts.length > 0) {
                    var divider = document.createElement("div");
                    divider.className = "mbx-divider";
                    popup.appendChild(divider);
                }

                var saveBtn = document.createElement("button");
                saveBtn.className = "mbx-save";
                saveBtn.textContent = "+ Save Current Account";
                saveBtn.addEventListener("click", function (e) {
                    e.stopPropagation();
                    var t = getToken();
                    var u = getCurrentUser();
                    if (t && u) {
                        saveAccount(t, u);
                        renderSwitcher();
                        var p = document.getElementById("multibox-popup");
                        if (p) p.classList.add("open");
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
                btn.addEventListener("click", function (e) {
                    e.stopPropagation();
                    popup.classList.toggle("open");
                });

                container.appendChild(popup);
                container.appendChild(btn);
            }

            // Auto-save current account
            var token = getToken();
            var user = getCurrentUser();
            if (token && user) {
                saveAccount(token, user);
            }

            renderSwitcher();
            document.body.appendChild(container);

            // Retry save if user wasn't ready
            if (!user) {
                this._retryInterval = setInterval(function () {
                    var t = getToken();
                    var u = getCurrentUser();
                    if (t && u) {
                        saveAccount(t, u);
                        renderSwitcher();
                        clearInterval(self._retryInterval);
                    }
                }, 3000);
            }

            // Close popup on outside click
            this._outsideClick = function (e) {
                if (container.contains(e.target)) return;
                var p = document.getElementById("multibox-popup");
                if (p) p.classList.remove("open");
            };
            document.addEventListener("click", this._outsideClick);

            console.log(LOG, "Loaded OK —", (store.accounts || []).length, "accounts saved");
        } catch (err) {
            console.error("[Multibox] FATAL onLoad error:", err);
        }
    },

    onUnload() {
        if (this._container && this._container.parentNode) {
            this._container.parentNode.removeChild(this._container);
        }
        if (this._styleEl && this._styleEl.parentNode) {
            this._styleEl.parentNode.removeChild(this._styleEl);
        }
        if (this._outsideClick) {
            document.removeEventListener("click", this._outsideClick);
        }
        if (this._retryInterval) {
            clearInterval(this._retryInterval);
        }
        console.log("[Multibox]", "Unloaded");
    },

    settings() {
        var html = shelter.solidH.html;
        return html`
            <div style="color:var(--text-muted);font-size:14px;">
                <p style="margin:0 0 8px 0;">Use the floating button near the bottom-left corner to switch accounts.</p>
                <p style="margin:0;">Click it to open the account list. Click any account to instantly switch.</p>
                <p style="margin:8px 0 0 0;font-style:italic;font-size:12px;">Accounts are auto-saved when you log in. You can also save manually from the popup.</p>
            </div>
        `;
    }
})
