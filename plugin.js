const {
    flux: { storesFlat: { UserStore } },
    plugin: { store },
    settings: { registerSection },
    solid: { createSignal, onCleanup, For },
    solidWeb: { render },
    ui: { Button, TextBox, Header, HeaderTags, Divider, Text },
} = shelter;

const LOG = "[Multibox]";

// ─── Token helpers ──────────────────────────────────────────────

function getToken() {
    // Discord stores token in localStorage with quotes
    const raw = localStorage.getItem("token");
    return raw ? raw.replace(/^"|"$/g, "") : null;
}

function setToken(token) {
    localStorage.setItem("token", JSON.stringify(token));
}

// ─── Account management ─────────────────────────────────────────

function getAccounts() {
    return store.accounts || [];
}

function saveAccounts(accounts) {
    store.accounts = accounts;
}

function addCurrentAccount() {
    const token = getToken();
    if (!token) {
        console.error(LOG, "No token found");
        return false;
    }

    const user = UserStore?.getCurrentUser?.();
    if (!user) {
        console.error(LOG, "No current user");
        return false;
    }

    const accounts = getAccounts();

    // Don't add duplicates
    if (accounts.some((a) => a.id === user.id)) {
        console.log(LOG, "Account already saved:", user.username);
        // Update token in case it changed
        const idx = accounts.findIndex((a) => a.id === user.id);
        accounts[idx].token = token;
        accounts[idx].username = user.username;
        accounts[idx].avatar = user.avatar;
        saveAccounts([...accounts]);
        return false;
    }

    accounts.push({
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        discriminator: user.discriminator,
        token,
    });
    saveAccounts([...accounts]);
    console.log(LOG, "Saved account:", user.username);
    return true;
}

function removeAccount(id) {
    const accounts = getAccounts().filter((a) => a.id !== id);
    saveAccounts([...accounts]);
}

function switchToAccount(account) {
    const currentUser = UserStore?.getCurrentUser?.();
    if (currentUser?.id === account.id) return; // already on this account

    console.log(LOG, "Switching to:", account.username);
    setToken(account.token);
    location.reload();
}

// ─── UI ─────────────────────────────────────────────────────────

function getAvatarUrl(account) {
    if (!account.avatar) return `https://cdn.discordapp.com/embed/avatars/${(BigInt(account.id) >> 22n) % 6n}.png`;
    return `https://cdn.discordapp.com/avatars/${account.id}/${account.avatar}.png?size=32`;
}

function AccountSwitcher() {
    const [accounts, setAccounts] = createSignal(getAccounts());
    const currentUser = UserStore?.getCurrentUser?.();

    function refresh() {
        setAccounts(getAccounts());
    }

    function handleAdd() {
        addCurrentAccount();
        refresh();
    }

    function handleRemove(id) {
        removeAccount(id);
        refresh();
    }

    function handleSwitch(account) {
        switchToAccount(account);
    }

    const containerStyle = {
        display: "flex",
        "flex-direction": "column",
        gap: "8px",
    };

    const accountStyle = (isActive) => ({
        display: "flex",
        "align-items": "center",
        gap: "10px",
        padding: "8px 12px",
        "border-radius": "8px",
        background: isActive ? "var(--background-modifier-selected)" : "var(--background-secondary)",
        cursor: isActive ? "default" : "pointer",
        transition: "background 0.15s ease",
    });

    const avatarStyle = {
        width: "32px",
        height: "32px",
        "border-radius": "50%",
        "flex-shrink": "0",
    };

    const nameStyle = {
        flex: "1",
        color: "var(--text-normal)",
        "font-size": "14px",
        "font-weight": "500",
    };

    const activeStyle = {
        "font-size": "11px",
        color: "var(--text-positive)",
        "font-weight": "600",
    };

    const removeStyle = {
        color: "var(--text-muted)",
        cursor: "pointer",
        "font-size": "18px",
        padding: "0 4px",
        "line-height": "1",
        opacity: "0.6",
    };

    return (
        <div style={containerStyle}>
            <Text>
                Save your current account, then log into another and save that too.
                Click any account to switch instantly.
            </Text>
            <div style={{ "margin-top": "4px" }}>
                <Button onClick={handleAdd}>
                    Save Current Account
                </Button>
            </div>
            <Divider />
            <For each={accounts()}>
                {(account) => {
                    const isActive = currentUser?.id === account.id;
                    return (
                        <div
                            style={accountStyle(isActive)}
                            onClick={() => !isActive && handleSwitch(account)}
                            onMouseEnter={(e) => {
                                if (!isActive) e.currentTarget.style.background = "var(--background-modifier-hover)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = isActive
                                    ? "var(--background-modifier-selected)"
                                    : "var(--background-secondary)";
                            }}
                        >
                            <img src={getAvatarUrl(account)} style={avatarStyle} />
                            <span style={nameStyle}>
                                {account.username}
                            </span>
                            {isActive && <span style={activeStyle}>ACTIVE</span>}
                            <span
                                style={removeStyle}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemove(account.id);
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.6"; }}
                            >
                                ×
                            </span>
                        </div>
                    );
                }}
            </For>
            {accounts().length === 0 && (
                <Text style={{ color: "var(--text-muted)", "font-style": "italic" }}>
                    No accounts saved yet. Click "Save Current Account" to get started.
                </Text>
            )}
        </div>
    );
}

// ─── Plugin lifecycle ───────────────────────────────────────────

let unregisterSection = null;

export function onLoad() {
    console.log(LOG, "Loading...");

    // Auto-save current account on load
    addCurrentAccount();

    // Register in Discord settings
    unregisterSection = registerSection(
        "section",
        "multibox",
        "Multibox",
        AccountSwitcher,
    );

    console.log(LOG, "Loaded — open Discord Settings to manage accounts");
}

export function onUnload() {
    if (unregisterSection) unregisterSection();
    console.log(LOG, "Unloaded");
}

export const settings = AccountSwitcher;
