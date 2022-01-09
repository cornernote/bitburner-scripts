/**
 * Entry method
 *
 * @param {NS} ns
 */
export async function main(ns) {

    // Scan all servers and keep track of the path to get to them
    const servers = ["home"],
        routes = {home: ["home"]};
    for (let i = 0, j; i < servers.length; i++) {
        for (j of ns.scan(servers[i])) {
            if (!servers.includes(j)) {
                servers.push(j);
                routes[j] = routes[servers[i]].slice();
                routes[j].push(j);
            }
        }
    }
    // backdoor all servers
    for (const [host, route] of Object.entries(routes)) {
        if (ns.hasRootAccess(host) && host !== 'home') {
            ns.tprint(host);
            route.shift() // remove home
            for (const path of route) {
                await terminalCommand(ns, `connect ${path}`)
            }
            await terminalCommand(ns, 'backdoor', 15000)
            await terminalCommand(ns, 'home')
        }
    }

}

async function terminalCommand(ns, message, delay = 500) {
    const docs = globalThis['document']
    const terminalInput = /** @type {HTMLInputElement} */ (docs.getElementById("terminal-input"));
    terminalInput.value = message;
    const handler = Object.keys(terminalInput)[1];
    terminalInput[handler].onChange({target: terminalInput});
    terminalInput[handler].onKeyDown({keyCode: 13, preventDefault: () => null});
    await ns.sleep(delay)
}