disableLog("disableLog"); disableLog("brutessh"); disableLog("ftpcrack"); disableLog("relaysmtp");
disableLog("httpworm"); disableLog("sqlinject"); disableLog("nuke"); disableLog("getServerMinSecurityLevel");
disableLog("getServerRequiredHackingLevel"); disableLog("getHackingLevel"); disableLog("scp");
disableLog("getServerMoneyAvailable"); disableLog("fileExists"); disableLog("getServerNumPortsRequired");
disableLog("getServerUsedRam"); disableLog("getServerSecurityLevel"); disableLog("scan"); disableLog("killall");
disableLog("getServerMaxMoney"); disableLog("getServerMaxRam"); disableLog("getScriptRam"); tail();
//Stuff above is just for visual clarity in the console, couldn't get disable ALL to work :P

//      Welcome to my messy, horribly optimised, quickly slapped together script for beginners, by a beginner, good luck with this brain aneurysm which I tried to document
//      This whole thing will scan for all servers you can hack, then start automatically farming them, but it's not the fastest

var files = ["weaken.script", "grow.script", "hack.script"];//   The files you need to make in your home directory which will be sent with scp
//Contents:   weaken(args[0]); grow(args[0]); hack(args[0]);     These are as small as possible to allow for many threads

//Sets variables, I wouldn't touch them, might explode
var serverList = scan("home"); var serverCount = [serverList.length, 0];
var hk = [0, 0, 0, 0, 0]; var possibleThreads = 0; var scanLevel = 2;
var count = 0; var inner = 0; var approvedList = []; var exeCount = 0;
var linked; var target; var depth = 0; var checked = 0; var hackType;

//Checks if you have hacks so we know for later
if (fileExists("BruteSSH.exe"))   { hk[0] = 1; exeCount++ };
if (fileExists("FTPCrack.exe"))   { hk[1] = 1; exeCount++ };
if (fileExists("relaySMTP.exe"))  { hk[2] = 1; exeCount++ };
if (fileExists("HTTPWorm.exe"))   { hk[3] = 1; exeCount++ };
if (fileExists("SQLInject.exe"))  { hk[4] = 1; exeCount++ };
if (fileExists("DeepscanV1.exe")) { scanLevel += 2 };  //Comment out one or both of these lines if you don't have
if (fileExists("DeepscanV2.exe")) { scanLevel += 5 }; //high hack skill or want to avoid time consuming deep scans

//The badly formatted fun begins...
print("/---/ SEARCHING \\---\\\n-- Default --\n > "+ serverList.join("\n > ") + "\n>- Scan Limit: L" + [scanLevel + 1] + " -<") //Print is just for the visuals
while (count <= serverCount[depth] - 1 && depth < scanLevel) {//The scan will stop if  we hit depth limit
    linked = scan(serverList[checked]);checked++; //Scan will bring back all connected servers which we then run through checks below
    for (i = 0; i <= linked.length - 1; i++) {//If the scan results in 1 or more linked servers this area will cycle through them
        target = linked[i];//Targets 1 part of the scan result at a time
        if (target != "home" && !serverList.includes(target)) {//Makes sure our target isn't home or a server we already know of
            serverList.push(target);//Adds the target to the list
            print("L"+ [depth + 2] + " > " + target); serverCount[depth + 1]++;
        }
    }
    if (count == serverCount[depth] - 1) { count = 0; depth++; serverCount.push(0) } else { count++ };//I made this part 24 hours ago, good luck getting an explanation
}

print("/-------/ CHECKING \\-------\\");
for (i = 0; i <= serverList.length - 1; i++) {//Runs once for each entry in serverList
    target = serverList[i];
    if (getServerNumPortsRequired(target) > exeCount)                   { print(" >X<  SOFTWARE " + target) } //Denied if you cannot open the required ports
    else if (getServerMoneyAvailable(target) == 0)                      { print(" >X<  NO MONEY " + target) }//Denied if there's no loot
    else if (getServerMaxRam(target) < 2)                               { print(" >X<  NO RAM " + target) } //Denied because potato
    else if (getHackingLevel() < getServerRequiredHackingLevel(target)) { print(" >X<  SKILL " + target) } //Denied because your hacking is too low
    else {//Server approved, 5 lines below will open ports on target if you have the required exe
        if (hk[0]) { brutessh(target)  };
        if (hk[1]) { ftpcrack(target)  };
        if (hk[2]) { relaysmtp(target) };
        if (hk[3]) { httpworm(target)  };
        if (hk[4]) { sqlinject(target) };
        nuke(target); scp(files, "home", target); killall(target);//Nuke, transfer files and kill running scripts on target
        approvedList.push(target);//This server is ready to farm, puts it in the approved list for later
        print(" >>>  VALID " + target);
    }
}

print("/------------/ HACKING \\------------\\");
count = 0;//Reset so we can use it again
while (true) {//Runs forever
    if (count > approvedList.length - 1) { count = 0 }//Sets count to 0 if we reach the end of list, starts cycle again
    target = approvedList[count];//Picks server from list based on count
    if (getServerUsedRam(target) == 0) {                                                                    //If nothing is already running on server
        if (getServerSecurityLevel(target) > getServerMinSecurityLevel(target) + 5) { hackType = "weaken" }//and the security is too high, weaken           /You can change the 5
        else if (getServerMoneyAvailable(target) < getServerMaxMoney(target) * 0.80) { hackType = "grow" }//and the money is too low, boosto               /and the 0.80
        else { hackType = "hack" }                                                                       //and if everything is just right...
        print("|||||||||| " + hackType + " --> " + approvedList[count] + " ||||||||||");
        exec(hackType + ".script", target, Math.floor(getServerMaxRam(target) / getScriptRam(hackType + ".script")), target)//Runs 1 of the 3 scripts on target server against itself
    } count++;//Helps us cycle through our list                                                                   Threads are based on the amount of RAM the server has, rounded down
}