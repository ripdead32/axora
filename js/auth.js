const AXORA_ACCOUNT =
    "https://account.ripdead.de5.net";

const AXORA_CLIENT_ID =
    "axora";

const AXORA_REDIRECT_URI =
    "https://playaxora.ripdead.dedyn.io/callback/";

const AXORA_SESSION_KEY =
    "axora_session_token";

const AXORA_USER_KEY =
    "axora_user";


function getAxoraSessionToken() {
    return sessionStorage.getItem(
        AXORA_SESSION_KEY
    );
}


function getAxoraUser() {
    const raw =
        sessionStorage.getItem(
            AXORA_USER_KEY
        );

    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}


function setAxoraUser(user) {
    if (!user) {
        sessionStorage.removeItem(
            AXORA_USER_KEY
        );

        return;
    }

    sessionStorage.setItem(
        AXORA_USER_KEY,
        JSON.stringify(user)
    );
}


function isAxoraLoggedIn() {
    return !!getAxoraSessionToken();
}


/*
 * Send the user to Rip_Dead Account.
 *
 * Axora itself never asks for their
 * Rip_Dead password.
 */
function loginAxora() {

    const stateBytes =
        new Uint8Array(32);

    crypto.getRandomValues(
        stateBytes
    );

    const state =
        Array.from(stateBytes)
            .map(
                byte =>
                    byte
                        .toString(16)
                        .padStart(2, "0")
            )
            .join("");

    sessionStorage.setItem(
        "axora_oauth_state",
        state
    );


    const params =
        new URLSearchParams({
            client_id:
                AXORA_CLIENT_ID,

            redirect_uri:
                AXORA_REDIRECT_URI,

            response_type:
                "code",

            scope:
                "profile",

            state:
                state
        });


    /*
     * The Account site handles the actual
     * login and OAuth authorization.
     */
    window.location.href =
        `${AXORA_ACCOUNT}/oauth/authorize?${params.toString()}`;
}


function logoutAxora() {

    sessionStorage.removeItem(
        AXORA_SESSION_KEY
    );

    sessionStorage.removeItem(
        AXORA_USER_KEY
    );

    sessionStorage.removeItem(
        "axora_oauth_state"
    );

    window.location.href =
        "/";
}


function getAxoraUsername() {

    const user =
        getAxoraUser();

    if (!user) {
        return null;
    }

    return (
        user.username ||
        user.user_name ||
        null
    );
}


function getAxoraDisplayName() {

    const user =
        getAxoraUser();

    if (!user) {
        return null;
    }

    return (
        user.display_name ||
        user.displayName ||
        user.username ||
        user.user_name ||
        null
    );
}