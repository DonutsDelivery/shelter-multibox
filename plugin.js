({
    onLoad() {
        var LOG = "[Multibox]";
        var store = shelter.plugin.store;

        if (!store.accounts) store.accounts = [];

        function getToken() {
            var raw = localStorage.getItem("token");
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
            try { shelter.plugin.flushStore(); } catch (e) {}
            console.log(LOG, "Saved account:", user.username, "| Total:", accs.length);
            return accs;
        }

        function switchTo(account) {
            localStorage.setItem("token", JSON.stringify(account.token));
            location.reload();
        }

        // Auto-save current account on load (with retry if Discord isn't ready)
        var saved = false;
        function trySave() {
            if (saved) return true;
            var t = getToken();
            var u = getCurrentUser();
            if (t && u) {
                saveAccount(t, u);
                saved = true;
                renderSwitcher();
                return true;
            }
            return false;
        }

        if (!trySave()) {
            console.log(LOG, "User not ready, retrying...");
            this._retryInterval = setInterval(function () {
                if (trySave()) clearInterval(self._retryInterval);
            }, 2000);
        }

        var self = this;

        // === Inject CSS ===
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
            ".mbx-divider{height:1px;background:var(--background-modifier-accent);margin:4px 0}",
        ].join("\n");
        this._removeCss = shelter.plugin.scoped.injectCss(css);

        // === Build floating switcher DOM ===
        var container = document.createElement("div");
        container.id = "multibox-switcher";
        this._container = container;

        function renderSwitcher() {
            var accounts = JSON.parse(JSON.stringify(store.accounts || []));
            var cur = getCurrentUser();

            container.innerHTML = "";

            // Popup
            var popup = document.createElement("div");
            popup.id = "multibox-popup";

            accounts.forEach(function (account) {
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
                rm.onclick = function (e) {
                    e.stopPropagation();
                    store.accounts = (store.accounts || []).filter(function (a) { return a.id !== account.id; });
                    try { shelter.plugin.flushStore(); } catch (e2) {}
                    renderSwitcher();
                    // re-open popup
                    var p = document.getElementById("multibox-popup");
                    if (p) p.classList.add("open");
                };
                row.appendChild(rm);

                if (!isActive) {
                    row.onclick = function () { switchTo(account); };
                }

                popup.appendChild(row);
            });

            if (accounts.length > 0) {
                var divider = document.createElement("div");
                divider.className = "mbx-divider";
                popup.appendChild(divider);
            }

            var saveBtn = document.createElement("button");
            saveBtn.className = "mbx-save";
            saveBtn.textContent = "+ Save Current Account";
            saveBtn.onclick = function (e) {
                e.stopPropagation();
                var t = getToken();
                var u = getCurrentUser();
                if (t && u) {
                    saveAccount(t, u);
                    renderSwitcher();
                    var p = document.getElementById("multibox-popup");
                    if (p) p.classList.add("open");
                }
            };
            popup.appendChild(saveBtn);

            // Main button — shows current user's avatar
            var btn = document.createElement("button");
            btn.id = "multibox-btn";
            btn.title = "Switch Account (Multibox)";
            if (cur) {
                var img = document.createElement("img");
                img.src = getAvatarUrl({ id: cur.id, avatar: cur.avatar });
                btn.appendChild(img);
            } else {
                btn.textContent = "\u{1F464}";
            }
            btn.onclick = function (e) {
                e.stopPropagation();
                popup.classList.toggle("open");
            };

            container.appendChild(popup);
            container.appendChild(btn);
        }

        this._renderSwitcher = renderSwitcher;
        renderSwitcher();
        document.body.appendChild(container);

        // Close popup on outside click
        this._outsideClick = function (e) {
            if (container.contains(e.target)) return;
            var popup = document.getElementById("multibox-popup");
            if (popup) popup.classList.remove("open");
        };
        document.addEventListener("click", this._outsideClick);

        console.log(LOG, "Loaded —", (store.accounts || []).length, "accounts saved");
    },

    onUnload() {
        if (this._container && this._container.parentNode) {
            this._container.parentNode.removeChild(this._container);
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
