({
    onLoad() {
        var LOG = "[Multibox]";
        try {
            var store = shelter.plugin.store;
            var UserStore = shelter.flux.storesFlat.UserStore;

            function getToken() {
                var raw = localStorage.getItem("token");
                return raw ? raw.replace(/^"|"$/g, "") : null;
            }

            function getAccounts() {
                return store.accounts || [];
            }

            // Auto-save current account
            var token = getToken();
            var user = UserStore && UserStore.getCurrentUser && UserStore.getCurrentUser();
            if (token && user) {
                var accounts = getAccounts();
                var existing = accounts.findIndex(function(a) { return a.id === user.id; });
                if (existing >= 0) {
                    accounts[existing].token = token;
                    accounts[existing].username = user.username;
                    accounts[existing].avatar = user.avatar;
                } else {
                    accounts.push({
                        id: user.id,
                        username: user.username,
                        avatar: user.avatar,
                        token: token,
                    });
                }
                store.accounts = accounts.slice();
                console.log(LOG, "Saved account:", user.username);
            } else {
                console.log(LOG, "User not ready yet, skipping auto-save");
            }

            console.log(LOG, "Loaded —", getAccounts().length, "accounts saved");
        } catch (e) {
            console.error(LOG, "onLoad error:", e);
        }
    },

    onUnload() {
        console.log("[Multibox]", "Unloaded");
    },

    settings() {
        var html = shelter.solidH.html;
        var store = shelter.plugin.store;
        var UserStore = shelter.flux.storesFlat.UserStore;
        var createSignal = shelter.solid.createSignal;

        function getCurrentUser() {
            try {
                return UserStore && UserStore.getCurrentUser && UserStore.getCurrentUser();
            } catch(e) {
                return null;
            }
        }

        function getToken() {
            var raw = localStorage.getItem("token");
            return raw ? raw.replace(/^"|"$/g, "") : null;
        }

        function getAvatarUrl(account) {
            if (!account.avatar) return "https://cdn.discordapp.com/embed/avatars/" + (Number(BigInt(account.id) >> 22n) % 6) + ".png";
            return "https://cdn.discordapp.com/avatars/" + account.id + "/" + account.avatar + ".png?size=32";
        }

        var sig = createSignal(store.accounts || []);
        var accounts = sig[0];
        var setAccounts = sig[1];

        function refresh() {
            setAccounts((store.accounts || []).slice());
        }

        function saveCurrentAccount() {
            var token = getToken();
            var user = getCurrentUser();
            if (!token || !user) return;
            var accs = (store.accounts || []).slice();
            var idx = accs.findIndex(function(a) { return a.id === user.id; });
            if (idx >= 0) {
                accs[idx].token = token;
                accs[idx].username = user.username;
                accs[idx].avatar = user.avatar;
            } else {
                accs.push({ id: user.id, username: user.username, avatar: user.avatar, token: token });
            }
            store.accounts = accs;
            refresh();
        }

        function removeAccount(id) {
            store.accounts = (store.accounts || []).filter(function(a) { return a.id !== id; });
            refresh();
        }

        function switchTo(account) {
            var cur = getCurrentUser();
            if (cur && cur.id === account.id) return;
            localStorage.setItem("token", JSON.stringify(account.token));
            location.reload();
        }

        return html`
            <div style="display:flex;flex-direction:column;gap:8px;">
                <p style="color:var(--text-muted);margin:0 0 4px 0;font-size:14px;">
                    Save your current account, then log into another and save that too. Click any account to switch.
                </p>
                <button
                    onclick=${saveCurrentAccount}
                    style="padding:8px 16px;border-radius:4px;border:none;background:var(--brand-500);color:white;cursor:pointer;font-size:14px;font-weight:500;width:fit-content;"
                >Save Current Account</button>
                <div style="height:1px;background:var(--background-modifier-accent);margin:4px 0;" />
                ${() => {
                    var list = accounts();
                    var cur = getCurrentUser();
                    return list.map(function(account) {
                        var isActive = cur && cur.id === account.id;
                        return html`
                            <div
                                onclick=${function() { if (!isActive) switchTo(account); }}
                                style=${
                                    "display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;cursor:" +
                                    (isActive ? "default" : "pointer") +
                                    ";background:" +
                                    (isActive ? "var(--background-modifier-selected)" : "var(--background-secondary)")
                                }
                            >
                                <img src=${getAvatarUrl(account)} style="width:32px;height:32px;border-radius:50%;" />
                                <span style="flex:1;color:var(--text-normal);font-size:14px;font-weight:500;">${account.username}</span>
                                ${isActive ? html`<span style="font-size:11px;color:var(--text-positive);font-weight:600;">ACTIVE</span>` : ""}
                                <span
                                    onclick=${function(e) { e.stopPropagation(); removeAccount(account.id); }}
                                    style="color:var(--text-muted);cursor:pointer;font-size:18px;padding:0 4px;opacity:0.6;"
                                >×</span>
                            </div>
                        `;
                    });
                }}
                ${() => accounts().length === 0 ? html`
                    <p style="color:var(--text-muted);font-style:italic;margin:0;">
                        No accounts saved yet. Click "Save Current Account" to get started.
                    </p>
                ` : ""}
            </div>
        `;
    }
})
