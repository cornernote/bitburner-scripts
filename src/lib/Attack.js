/**
 * Attack helper functions
 */


// /**
//  * Assign the attack threads between our hacking servers
//  *
//  * @param {NS} ns
//  * @param {Server[]} servers
//  * @param {AttackPart[]} attackParts
//  * @param {number} maxCycles
//  * @returns {number}
//  */
// export function countCycles(ns, servers, attackParts, maxCycles = 1) {
//     const serverRam = {}
//     // check the ram for as many cycles as needed
//     for (let cycle = 1; cycle <= maxCycles; cycle++) {
//         // assign each attack part to a server
//         for (const part of Object.values(attackParts)) {
//             // assign each thread to a server
//             let threadsRemaining = part.threads
//             for (let i = 0; i < servers.length; i++) {
//                 const server = servers[i]
//                 const threadsFittable = Math.max(0, Math.floor((server.maxRam - server.ramUsed) / part.ram))
//                 const threadsToRun = Math.max(0, Math.min(threadsFittable, threadsRemaining))
//                 // if there are not enough threads, and we cannot spread the threads
//                 if (threadsToRun < threadsRemaining && !part.allowSpreading) {
//                     continue
//                 }
//                 // create assign the ram to this server
//                 if (threadsToRun) {
//                     threadsRemaining -= threadsToRun
//                     server.ramUsed += threadsToRun * part.ram
//                     if (!serverRam[server.hostname]) {
//                         serverRam[server.hostname] = 0
//                     }
//                     serverRam[server.hostname] += threadsToRun * part.ram
//                 }
//             }
//             // if threads are remaining then we exceeded the limit
//             if (threadsRemaining) {
//                 maxCycles = cycle - 1
//             }
//         }
//     }
//     // give back the ram
//     for (const server of servers) {
//         if (serverRam[server.hostname]) {
//             server.ramUsed -= serverRam[server.hostname]
//         }
//     }
//     // return the count
//     return maxCycles
// }
