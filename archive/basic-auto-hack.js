/**
 * @param {NS} ns
 */
export async function main(ns) {
    const files = ["/hacks/weaken.js", "/hacks/grow.js", "/hacks/hack.js"];

    const serverList = ns.scan("home");
    const serverCount = [serverList.length, 0];
    const hk = [0, 0, 0, 0, 0];
    let scanLevel = 2;
    let count = 0;
    const approvedList = [];
    let exeCount = 0;
    let linked;
    let target;
    let depth = 0;
    let checked = 0;
    let hackType;

//Checks if you have hacks so we know for later
    if (ns.fileExists("BruteSSH.exe")) {
        hk[0] = 1;
        exeCount++
    }
    if (ns.fileExists("FTPCrack.exe")) {
        hk[1] = 1;
        exeCount++
    }
    if (ns.fileExists("relaySMTP.exe")) {
        hk[2] = 1;
        exeCount++
    }
    if (ns.fileExists("HTTPWorm.exe")) {
        hk[3] = 1;
        exeCount++
    }
    if (ns.fileExists("SQLInject.exe")) {
        hk[4] = 1;
        exeCount++
    }
    if (ns.fileExists("DeepscanV1.exe")) {
        scanLevel += 2
    }
    if (ns.fileExists("DeepscanV2.exe")) {
        scanLevel += 5
    }

//The badly formatted fun begins...
    ns.tprint("/---/ SEARCHING \\---\\\n-- Default --\n > " + serverList.join("\n > ") + "\n>- Scan Limit: L" + [scanLevel + 1] + " -<") //Print is just for the visuals
    while (count <= serverCount[depth] - 1 && depth < scanLevel) {//The scan will stop if  we hit depth limit
        linked = ns.scan(serverList[checked]);
        checked++; //Scan will bring back all connected servers which we then run through checks below
        for (let i = 0; i <= linked.length - 1; i++) {//If the scan results in 1 or more linked servers this area will cycle through them
            target = linked[i];//Targets 1 part of the scan result at a time
            if (target !== "home" && !serverList.includes(target)) {//Makes sure our target isn't home or a server we already know of
                serverList.push(target);//Adds the target to the list
                ns.tprint("L" + [depth + 2] + " > " + target);
                serverCount[depth + 1]++;
            }
        }
        if (count === serverCount[depth] - 1) {
            count = 0;
            depth++;
            serverCount.push(0)
        } else {
            count++
        }
    }

    ns.tprint("/-------/ CHECKING \\-------\\");
    for (let i = 0; i <= serverList.length - 1; i++) {//Runs once for each entry in serverList
        target = serverList[i];
        if (ns.getServerNumPortsRequired(target) > exeCount) {
            ns.tprint(" >X<  SOFTWARE " + target)
        } //Denied if you cannot open the required ports
        else if (ns.getServerMoneyAvailable(target) === 0) {
            ns.tprint(" >X<  NO MONEY " + target)
        }//Denied if there's no loot
        else if (ns.getServerMaxRam(target) < 2) {
            ns.tprint(" >X<  NO RAM " + target)
        } //Denied because potato
        else if (ns.getHackingLevel() < ns.getServerRequiredHackingLevel(target)) {
            ns.tprint(" >X<  SKILL " + target)
        } //Denied because your hacking is too low
        else {//Server approved, 5 lines below will open ports on target if you have the required exe
            if (hk[0]) {
                ns.brutessh(target)
            }
            if (hk[1]) {
                ns.ftpcrack(target)
            }
            if (hk[2]) {
                ns.relaysmtp(target)
            }
            if (hk[3]) {
                ns.httpworm(target)
            }
            if (hk[4]) {
                ns.sqlinject(target)
            }
            ns.nuke(target);
            await ns.scp(files, "home", target);
            ns.killall(target);//Nuke, transfer files and kill running scripts on target
            approvedList.push(target);//This server is ready to farm, puts it in the approved list for later
            ns.tprint(" >>>  VALID " + target);
        }
    }

    ns.tprint("/------------/ HACKING \\------------\\");
    count = 0;
    //Reset so we can use it again
    while (true) {
        //Runs forever
        if (count > approvedList.length - 1) {
            count = 0
        }
        //Sets count to 0 if we reach the end of list, starts cycle again
        target = approvedList[count];//Picks server from list based on count
        if (ns.getServerUsedRam(target) === 0) {
            //If nothing is already running on server
            if (ns.getServerSecurityLevel(target) > ns.getServerMinSecurityLevel(target) + 5) {
                hackType = "weaken"
            }
            //and the security is too high, weaken           /You can change the 5
            else if (ns.getServerMoneyAvailable(target) < ns.getServerMaxMoney(target) * 0.80) {
                hackType = "grow"
            }
            //and the money is too low, boosto               /and the 0.80
            else {
                hackType = "hack"
            }
            //and if everything is just right...
            ns.tprint("|||||||||| " + hackType + " --> " + approvedList[count] + " ||||||||||");
            //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock, 7: tprint, 8: toast]
            ns.exec('/hacks/' + hackType + '.js', target, Math.floor(ns.getServerMaxRam(target) / ns.getScriptRam('/hacks/' + hackType + '.js')), target)
            //Runs 1 of the 3 scripts on target server against itself
        }
        count++;
        //Helps us cycle through our list
        // Threads are based on the amount of RAM the server has, rounded down
        await ns.sleep(20)
    }
}