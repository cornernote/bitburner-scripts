/**
 * Entry method
 *
 * @param {NS} ns
 */
export async function main(ns) {

    let servers = ["home"],
        routes = { home: ["home"] },
        myHackingLevel = ns.getHackingLevel();
    // Scan all servers and keep track of the path to get to them
    ns.disableLog("scan");
    for (let i = 0, j; i < servers.length; i++)
        for (j of ns.scan(servers[i]))
            if (!servers.includes(j)) servers.push(j), routes[j] = routes[servers[i]].slice(), routes[j].push(j);


    //ns.tprint(servers);
    ns.tprint(routes);

}

