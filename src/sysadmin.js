import {Runner} from "/lib/Runner";

/**
 * SysAdmin entry method
 *
 * @param {NS} ns
 */
export async function main(ns) {
    const runner = new Runner(ns);
    const sysadmin = new SysAdmin(ns, runner);
    await sysadmin.doWork();
}

/**
 * SysAdmin
 *
 * Manages the game for the player boss.
 */
export class SysAdmin {

    /**
     * SysAdmin settings
     * @type {Object}
     */
    settings = {

        // reserved memory on home
        // used to run the daemon and background runners
        reservedHomeRam: 1.6 + 10, // 1.6 for a background script, plus the max ram function used

        // the prefix given to purchased servers
        purchasedServerPrefix: 'homenet-',

        // used to calculate hack value
        // hackValue = server.moneyMax * (settings.minSecurityWeight / (server.minSecurityLevel + server.securityLevel))
        minSecurityWeight: 100,

        // used to decide if hack action=weaken
        // if (bestTarget.securityLevel > bestTarget.minSecurityLevel + settings.minSecurityLevelOffset) action = 'weaken'
        minSecurityLevelOffset: 1,

        // used to decide if hack action=grow
        // if (bestTarget.money < bestTarget.moneyMax * settings.maxMoneyMultiplayer) action = 'grow'
        maxMoneyMultiplayer: 0.9,

    }

    /**
     * The BitBurner instance
     * @type {NS}
     */
    ns

    /**
     * The Runner instance
     * @type {Runner}
     */
    runner

    /**
     * Player data
     * @type {Player}
     */
    player

    /**
     * Server data
     * @type {Server[]}
     */
    servers

    /**
     * Server data, containing servers rooted this run
     * @type {Server[]}
     */
    newlyRootedServers

    /**
     * Server data, sorted by hack value
     * @type {Server[]}
     */
    weightedServers

    /**
     * List of tools that are used to root servers
     * @type {Array}
     */
    tools

    /**
     * List of hacks that are used to hack servers
     * @type {Object}
     */
    hacks

    /**
     * List of attacks we will be running to hack servers
     * @type {Array}
     */
    attacks

    /**
     * Construct the class
     *
     * @param {NS} ns - the NS instance passed into the scripts main() entry method
     * @param {Runner} runner - the runner object
     * @param {Object} config - key/value pairs used to set object properties
     */
    constructor(ns, runner, config = {}) {
        this.ns = ns;
        this.runner = runner;
        // allow override of properties in this class
        Object.entries(config).forEach(([key, value]) => this[key] = value);
    }

    /**
     * The main loop.
     *
     * @returns {Promise<void>}
     */
    async doWork() {
        // get required data to...
        this.ns.tprint('Building data...');
        await this.loadPlayer();
        await this.loadTools();
        await this.loadServers();
        // ...do some work

        // root some servers
        this.ns.tprint('rootServers()...');
        await this.rootServers();

        // build an attack
        this.ns.tprint('loadAttacks()...');
        await this.loadAttacks();
        await this.attackServers();

        // then tell the player boss
        this.ns.tprint(this.getReports());
    }

    /**
     * Loads the player information.
     *
     * @returns {Promise<*[]>}
     */
    async loadPlayer() {
        this.player = await this.runner.nsProxy['getPlayer']();
    }

    /**
     * Loads a list of attack tools.
     *
     * @returns {Promise<*[]>}
     */
    async loadTools() {
        this.tools = [];
        const cracks = {
            brutessh: 'BruteSSH.exe',
            ftpcrack: 'FTPCrack.exe',
            relaysmtp: 'relaySMTP.exe',
            httpworm: 'HTTPWorm.exe',
            sqlinject: 'SQLInject.exe',
            nuke: 'NUKE.exe',
        };
        for (const [method, exe] of Object.entries(cracks)) {
            this.tools.push({
                method: method,
                exe: exe,
                owned: await this.runner.nsProxy['fileExists'](exe, 'home'),
            });
        }
    }

    /**
     * Loads a list of servers in the network.
     *
     * @returns {Promise<*[]>}
     */
    async loadServers() {
        this.servers = [];
        const spider = ['home'];
        while (spider.length > 0) {
            const host = spider.pop();
            for (const scannedHostName of await this.runner.nsProxy['scan'](host)) {
                if (this.servers.filter(s => s.hostname === scannedHostName).length === 0) {
                    spider.push(scannedHostName);
                }
            }
            this.servers.push(await this.runner.nsProxy['getServer'](host));
        }
    }

    /**
     * Loads a list of hacks
     *
     * @returns {Promise<*[]>}
     */
    async loadHacks() {
        // filter some lists
        const bestTarget = this.weightedServers[0];
        const hackingServers = this.servers
            .filter(s => !s.hostname.includes('hacknet-')) // exclude hacknet-
            .filter(s => s.hasAdminRights); // include servers with root access

        // build the hack list
        this.hacks = {
            weaken: {
                script: '/hacks/weaken-target.js',
                ram: 0,
                time: await this.runner.nsProxy['getWeakenTime'](bestTarget.hostname) / 1000,
                maxThreads: 0,
                threads: 0,
                change: 0.05,
            },
            grow: {
                script: '/hacks/grow-target.js',
                ram: 0,
                time: await this.runner.nsProxy['getGrowTime'](bestTarget.hostname) / 1000,
                maxThreads: 0,
                change: 0.004,
            },
            hack: {
                script: '/hacks/hack-target.js',
                ram: 0,
                time: await this.runner.nsProxy['getHackTime'](bestTarget.hostname) / 1000,
                maxThreads: 0,
                threads: 0,
                change: 0.002,
            },
        };
        // calculate the ram needed
        for (const _hack of Object.values(this.hacks)) {
            _hack.ram = await this.runner.nsProxy['getScriptRam'](_hack.script);
        }
        // calculate the maximum threads based on available ram
        for (const server of hackingServers) {
            let ram = server.maxRam - server.ramUsed;
            if (server.hostname === 'home') {
                ram -= this.settings.reservedHomeRam // reserve memory on home
            }
            for (const _hack of Object.values(this.hacks)) {
                _hack.maxThreads += Math.floor(ram / _hack.ram);
            }
        }
        const hacks = this.hacks,
            weaken = hacks['weaken'],
            grow = hacks['grow'],
            hack = hacks['hack'];
    }

    /**
     * Gain root access on any available servers.
     *
     * @returns {Promise<void>}
     */
    async rootServers() {
        this.newlyRootedServers = [];

        // filter some lists
        const ownedTools = this.tools
            .filter(a => a.owned);
        const rootableServers = this.servers
            .filter(s => !s.hasAdminRights) // exclude servers with root access
            .filter(s => s.requiredHackingSkill <= this.player.hacking); // include servers within hacking level

        // run owned tools on rootable servers
        if (rootableServers.length) {
            for (const server of rootableServers) {
                // run root tools
                for (const tool of ownedTools) {
                    await this.runner.nsProxy[tool.method](server.hostname);
                }
                // copy hack scripts
                await this.runner.nsProxy['scp'](['/hacks/weaken-target.js', '/hacks/grow-target.js', '/hacks/hack-target.js'], server.hostname);
                // add to list
                this.newlyRootedServers.push(server);
            }
            // rebuild server list
            await this.loadServers(); // todo, just reload the changed servers instead of all?
        }
    }

    /**
     * Load the attack plan
     *
     * @returns {Promise<void>}
     */
    async loadAttacks() {
        // filter some lists
        const rootedServers = this.servers
            .filter(s => s.hostname !== 'home' && !s.hostname.includes('hacknet-') && !s.hostname.includes(this.settings.purchasedServerPrefix)) // exclude home/hacknet-/homenet-
            .filter(s => s.hasAdminRights); // include servers with root access
        const hackingServers = this.servers
            .filter(s => !s.hostname.includes('hacknet-')) // exclude hacknet-
            .filter(s => s.hasAdminRights); // include servers with root access

        // get servers in order of hack value
        this.weightedServers = [];
        for (const server of rootedServers) {
            // get some more info about the servers
            server.analyze = await this.runner.nsProxy['hackAnalyze'](server.hostname);
            server.securityLevel = await this.runner.nsProxy['getServerSecurityLevel'](server.hostname);
            server.minSecurityLevel = await this.runner.nsProxy['getServerMinSecurityLevel'](server.hostname);
            server.fullHackCycles = Math.ceil(100 / Math.max(0.00000001, server.analyze));
            server.hackValue = server.moneyMax * (this.settings.minSecurityWeight / (server.minSecurityLevel + server.securityLevel));
            this.weightedServers.push(server);
        }
        this.weightedServers.sort((a, b) => b.hackValue - a.hackValue);
        const bestTarget = this.weightedServers[0];
        await this.loadHacks(); // after weightedServers is updated

        // decide which action to perform
        let action = 'hack';
        if (bestTarget.securityLevel > bestTarget.minSecurityLevel + this.settings.minSecurityLevelOffset) {
            action = 'weaken';
        } else if (bestTarget.moneyAvailable < bestTarget.moneyMax * this.settings.maxMoneyMultiplayer) {
            action = 'grow';
        }

        // calculate hacks time and number of threads we can run
        const hacks = this.hacks,
            weaken = hacks['weaken'],
            grow = hacks['grow'],
            hack = hacks['hack'];

        // TODO -- SORT THIS OUT
        function weakenThreadsForGrow(growThreads) {
            return Math.max(0, Math.ceil(growThreads * (grow.changes / weaken.changes)))
        }

        function weakenThreadsForHack(hackThreads) {
            return Math.max(0, Math.ceil(hackThreads * (hack.changes / weaken.changes)))
        }

        // build the attacks
        this.attacks = [];
        weaken.threads = weaken.maxThreads;
        grow.threads = grow.maxThreads;
        hack.threads = hack.maxThreads;
        let actionLog = '';
        switch (action) {
            // spawn threads to WEAKEN the target
            case 'weaken':
                if (weaken.changes * weaken.threads > bestTarget.securityLevel - bestTarget.minSecurityLevel) {
                    weaken.threads = Math.ceil((bestTarget.securityLevel - bestTarget.minSecurityLevel) / weaken.changes);
                    grow.threads = Math.max(0, grow.threads - weaken.threads);
                    weaken.threads += weakenThreadsForGrow(grow.threads);
                    grow.threads = Math.max(0, grow.threads - weakenThreadsForGrow(grow.threads));
                } else {
                    grow.threads = 0;
                }
                actionLog = `Cycles ratio: ${grow.threads} grow cycles; ${weaken.threads} weaken cycles; expected security reduction: ${Math.floor(weaken.changes * weaken.threads * 1000) / 1000}`;

                for (const server of hackingServers) {
                    let threadsFittable = Math.max(0, Math.floor((server.maxRam - server.ramUsed) / weaken.ram));
                    const threadsToRun = Math.max(0, Math.min(threadsFittable, grow.threads));
                    if (grow.threads) {
                        //grow[0: target, 1: desired start time, 2: expected end, 3: expected duration, 4: description, 5: manipulate stock, 6: loop]
                        this.attacks.push([grow.script, server.hostname, threadsToRun, bestTarget.hostname]); // todo
                        grow.threads -= threadsToRun;
                        threadsFittable -= threadsToRun;
                    }
                    if (threadsFittable) {
                        //weak[0: target, 1: desired start time, 2: expected end, 3: expected duration, 4: description, 5: disable toast warnings, 6: loop]
                        this.attacks.push([weaken.script, server.hostname, threadsFittable, bestTarget.hostname]); // todo
                        weaken.threads -= threadsFittable;
                    }
                }
                break;
            // spawn threads to GROW the target
            case 'grow':
                weaken.threads = weakenThreadsForGrow(grow.threads);
                grow.threads -= weaken.threads;
                this.ns.tprint(`Cycles ratio: ${grow.threads} grow cycles; ${weaken.threads} weaken cycles`);

                for (const server of hackingServers) {
                    let threadsFittable = Math.max(0, Math.floor(server.ram / grow.ram));
                    const threadsToRun = Math.max(0, Math.min(threadsFittable, grow.threads));
                    if (grow.threads) {
                        //grow[0: target, 1: desired start time, 2: expected end, 3: expected duration, 4: description, 5: manipulate stock, 6: loop]
                        this.attacks.push([grow.script, server.hostname, threadsToRun, bestTarget.hostname]); // todo
                        grow.threads -= threadsToRun;
                        threadsFittable -= threadsToRun;
                    }
                    if (threadsFittable) {
                        //weak[0: target, 1: desired start time, 2: expected end, 3: expected duration, 4: description, 5: disable toast warnings, 6: loop]
                        this.attacks.push([weaken.script, server.hostname, threadsFittable, bestTarget.hostname]); // todo
                        weaken.threads -= threadsFittable;
                    }
                }
                break;
            // spawn threads to HACK the target
            case 'hack':
            default:
                if (hack.threads > bestTarget.fullHackCycles) {
                    hack.threads = bestTarget.fullHackCycles;
                    if (hack.threads * 100 < grow.threads) {
                        hack.threads *= 10;
                    }
                    grow.threads = Math.max(0, grow.threads - Math.ceil((hack.threads * hack.ram) / grow.ram));
                    weaken.threads = weakenThreadsForGrow(grow.threads) + weakenThreadsForHack(hack.threads);
                    grow.threads = Math.max(0, grow.threads - weaken.threads);
                    hack.threads = Math.max(0, hack.threads - Math.ceil((weakenThreadsForHack(hack.threads) * weaken.ram) / hack.ram));
                } else {
                    grow.threads = 0;
                    weaken.threads = weakenThreadsForHack(hack.threads);
                    hack.threads = hack.threads - Math.ceil((weaken.threads * weaken.ram) / hack.ram);
                }
                this.ns.tprint(`Cycles ratio: ${hack.threads} hack cycles; ${grow.threads} grow cycles; ${weaken.threads} weaken cycles`)

                for (const server of hackingServers) {
                    let cyclesFittable = Math.max(0, Math.floor(server.ram / hack.ram));
                    const cyclesToRun = Math.max(0, Math.min(cyclesFittable, hack.threads));
                    if (hack.threads) {
                        //hack[0: target, 1: desired start time, 2: expected end, 3: expected duration, 4: description, 5: manipulate stock, 6: disable toast warnings, 7: loop]
                        this.attacks.push([hack.script, server.hostname, cyclesToRun, bestTarget.hostname]); // todo
                        hack.threads -= cyclesToRun;
                        cyclesFittable -= cyclesToRun;
                    }
                    const freeRam = server.ram - cyclesToRun * 1.7
                    cyclesFittable = Math.max(0, Math.floor(freeRam / grow.ram))
                    if (cyclesFittable && grow.threads) {
                        const growCyclesToRun = Math.min(grow.threads, cyclesFittable)
                        //grow[0: target, 1: desired start time, 2: expected end, 3: expected duration, 4: description, 5: manipulate stock, 6: loop]
                        this.attacks.push([grow.script, server.hostname, growCyclesToRun, bestTarget.hostname]); // todo
                        grow.threads -= growCyclesToRun;
                        cyclesFittable -= growCyclesToRun;
                    }
                    if (cyclesFittable) {
                        //weak[0: target, 1: desired start time, 2: expected end, 3: expected duration, 4: description, 5: disable toast warnings, 6: loop]
                        this.attacks.push([weaken.script, server.hostname, cyclesFittable, bestTarget.hostname]); // todo
                        weaken.threads -= cyclesFittable;
                    }
                }
                break;
        }
    }


    /**
     * Gain root access on any available servers.
     *
     * @returns {Promise<void>}
     */
    async attackServers() {
        for (const attack of this.attacks) {
            await this.runner.nsProxy['exec'](...attack);
        }
    }


    /**
     * Let's collect what we did, the player boss will want to know.
     *
     * @returns {string}
     */
    getReports() {
        // filter some lists
        const ownedTools = this.tools
            .filter(a => a.owned);
        const myServers = this.servers
            .filter(s => s.hostname === 'home' || s.hostname.includes('hacknet-') || s.hostname.includes(this.settings.purchasedServerPrefix)); // exclude home/hacknet-/homenet-

        // build the reports
        const reports = [];
        reports.push([
            'displaying reports...',
        ]);

        // player
        const playerReport = [
            '==============',
            `|| ☺ Player ||`,
            '==============',
            '',
            `Hacking Level: ${this.player.hacking}`,
            `Tools: ${ownedTools.length}/${this.tools.length} (${ownedTools.map(a => a.exe).join(', ')})`,
            `Money: ${this.ns.nFormat(this.player.money, '$0.000a')}`,
            `HP/Max: ${this.player.hp} / ${this.player.max_hp}`,
            `City/Location: ${this.player.city} / ${this.player.location}`,
        ];
        reports.push(playerReport);

        // server
        const bestTarget = this.weightedServers[0];
        const rootableServers = this.servers
            .filter(s => !s.hasAdminRights) // exclude servers with root access
            .filter(s => s.requiredHackingSkill <= this.player.hacking); // include servers within hacking level
        const serversReport = [
            '===============',
            `|| 🖥 Servers ||`,
            '===============',
            '',
            `${this.servers.length} servers found in the network:`,
            ` -> ${this.servers.map(s => s.hostname).join(', ')}`,
            '',
            `${myServers.length} servers are yours:`,
            ` -> ${myServers.map(s => s.hostname + ' = ' + s.ramUsed + '/' + s.maxRam + 'GB').join(', ')}`,
            '',
            `${this.weightedServers.length} servers have root access:`,
            ` -> ${this.weightedServers.map(s => s.hostname + ' = ' + this.ns.nFormat(s.hackValue, '$0.0a') + ' | ' + s.ramUsed + '/' + s.maxRam + 'GB').join(', ')}`,
            '',
            `Best target is ${bestTarget.hostname}:`,
            ` -> ${this.ns.nFormat(bestTarget.hackValue, '$0.0a')}`,
        ];
        if (rootableServers.length) {
            serversReport.push('');
            serversReport.push(`${rootableServers.length} servers are within hacking level (${this.player.hacking})`);
            serversReport.push(` -> ${rootableServers.map(s => s.hostname).join(', ')}`);
        }
        reports.push(serversReport);

        // hacking
        const hackingReport = [
            '===============',
            `|| 🖧 Hacking ||`,
            '===============',
        ];
        if (this.newlyRootedServers.length) {
            hackingReport.push('');
            hackingReport.push('Servers Rooted:');
            hackingReport.push(` -> ${this.newlyRootedServers.map(s => s.hostname).join(', ')}`);
        }
        // hackingReport.push('');
        // hackingReport.push('Hacks:');
        // for (const [name, hack] of Object.entries(this.hacks)) {
        //     hackingReport.push(' -> ' + name + ': ' + [
        //         `ram=${hack.ram}GB`,
        //         `time=${this.ns.nFormat(hack.time, '00:00:00')}`,
        //         `threads=${hack.threads}`,
        //         `change=${hack.change}`,
        //     ].join(' | '));
        // }
        if (this.attacks.length) {
            hackingReport.push('');
            hackingReport.push('Attacks Launched:');
            for (const a of this.attacks) {
                // all[0: script, 1: host, 2: threads, 3: target, 4: desired start time, 5: expected end, 6: expected duration, 7: description]
                const baseUrl = `hbbp://${a[1]}/${a[0]}?`;
                const params = [
                    `threads=${a[2]}`,
                    `target=${a[3]}`,
                ];
                if (a[4]) params.push(`start=${a[4]}`);
                if (a[5]) params.push(`end=${a[4]}`);
                if (a[6]) params.push(`dur=${a[4]}`);
                if (a[7]) params.push(`desc=${a[4]}`);
                switch (a[0]) {
                    case this.hacks['weaken'].script:
                        //weak[8: disable toast warnings, 9: loop]
                        if (a[8]) params.push(`noToast=${a[8]}`);
                        if (a[9]) params.push(`loop=${a[9]}`);
                        break;
                    case this.hacks['grow'].script:
                        //grow[8: manipulate stock, 9: loop]
                        if (a[8]) params.push(`stock=${a[8]}`);
                        if (a[9]) params.push(`loop=${a[9]}`);
                        hackingReport.push(` -> hbbp://${a[1]}/${a[0]}?threads=${a[2]}&target=${a[3]}&start=${a[4]}&end=${a[5]}&dur=${a[6]}&desc=${a[7]}`);
                        break;
                    case this.hacks['hack'].script:
                        //hack[8: manipulate stock, 9: disable toast warnings, 10: loop]
                        if (a[8]) params.push(`stock=${a[8]}`);
                        if (a[9]) params.push(`noToast=${a[9]}`);
                        if (a[10]) params.push(`loop=${a[10]}`);
                        hackingReport.push(` -> hbbp://${a[1]}/${a[0]}?threads=${a[2]}&target=${a[3]}&start=${a[4]}&end=${a[5]}&dur=${a[6]}&desc=${a[7]}`);
                        break;
                }
                hackingReport.push(' -> ' + baseUrl + params.join('&'));
            }
        }
        reports.push(hackingReport);

        // glue it together
        return reports.map(r => r.join("\n")).join("\n\n\n") + "\n\n\n";
    }

}