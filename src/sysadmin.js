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
     * List of port hacks that are used to root servers
     * @type {Array}
     */
    portHacks

    /**
     * List of hacks that are used to hack servers
     * @type {Object}
     */
    hacks

    /**
     * Information about the action taken for the cycle.
     * @type {String}
     */
    action

    /**
     * Information about the cycle.
     * @type {String}
     */
    ratioLog

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
        await this.loadPortHacks();
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
     * Loads a list of port hacks.
     *
     * @returns {Promise<*[]>}
     */
    async loadPortHacks() {
        this.portHacks = [];
        const cracks = {
            brutessh: 'BruteSSH.exe',
            ftpcrack: 'FTPCrack.exe',
            relaysmtp: 'relaySMTP.exe',
            httpworm: 'HTTPWorm.exe',
            sqlinject: 'SQLInject.exe',
            // nuke: 'NUKE.exe', // not a port hack
        };
        for (const [method, exe] of Object.entries(cracks)) {
            this.portHacks.push({
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
            // name: {
            //     script:      // target script
            //     ram:         // ram needed (calculated below)
            //     time:        // time to run
            //     delay:       // delay ensures hacks finish in order (calculated below)
            //     maxThreads:  // the max threads that can be run on our ram (calculated below)
            //     threads:     // the remaining threads to run (calculated during loadAttacks)
            //     change:      // security change per thread
            // }
            weaken: {
                script: '/hacks/weaken.js',
                ram: 0,
                time: await this.runner.nsProxy['getWeakenTime'](bestTarget.hostname) / 1000,
                delay: 0,
                maxThreads: 0,
                threads: 0,
                change: 0.05,
            },
            grow: {
                script: '/hacks/grow.js',
                ram: 0,
                time: await this.runner.nsProxy['getGrowTime'](bestTarget.hostname) / 1000,
                delay: 0,
                maxThreads: 0,
                change: 0.004,
            },
            hack: {
                script: '/hacks/hack.js',
                ram: 0,
                time: await this.runner.nsProxy['getHackTime'](bestTarget.hostname) / 1000,
                delay: 0,
                maxThreads: 0,
                threads: 0,
                change: 0.002,
            },
        };
        // expose vars for shorter code below
        const hacks = this.hacks,
            weaken = hacks['weaken'],
            grow = hacks['grow'],
            hack = hacks['hack'];
        // calculate the ram needed
        for (const _hack of Object.values(hacks)) {
            _hack.ram = await this.runner.nsProxy['getScriptRam'](_hack.script);
        }
        // calculate the maximum threads based on available ram
        for (const server of hackingServers) {
            let ram = server.maxRam - server.ramUsed;
            if (server.hostname === 'home') {
                ram -= this.settings.reservedHomeRam // reserve memory on home
            }
            for (const _hack of Object.values(hacks)) {
                _hack.maxThreads += Math.floor(ram / _hack.ram);
            }
        }
        // calculate the delay required for all threads to end at the right time
        grow.delay = Math.max(0, weaken.time - grow.time - 20);
        hack.delay = Math.max(0, grow.time + grow.delay - hack.time - 20);
    }

    /**
     * Gain root access on any available servers.
     *
     * @returns {Promise<void>}
     */
    async rootServers() {
        this.newlyRootedServers = [];

        // filter some lists
        const ownedPortHacks = this.portHacks
            .filter(a => a.owned);
        const rootableServers = this.servers
            .filter(s => !s.hasAdminRights) // exclude servers with root access
            .filter(s => s.requiredHackingSkill <= this.player.hacking); // include servers within hacking level

        // run owned port hacks on rootable servers
        if (rootableServers.length) {
            for (const server of rootableServers) {
                // skip if we have don't enough tools
                if (ownedPortHacks.length < server.numOpenPortsRequired) {
                    continue;
                }
                // run port hacks
                for (const portHack of ownedPortHacks) {
                    await this.runner.nsProxy[portHack.method](server.hostname);
                }
                // run nuke
                await this.runner.nsProxy['nuke'](server.hostname);
                // copy hack scripts
                await this.runner.nsProxy['scp'](['/hacks/grow.js', '/hacks/hack.js', '/hacks/weaken.js'], server.hostname);
                // add to list
                this.newlyRootedServers.push(server);
            }
            if (this.newlyRootedServers.length) {
                // rebuild server list
                await this.loadServers(); // todo, just reload the changed servers instead of all?
            }
        }
    }

    /**
     * Load the attack plan
     *
     * @see https://github.com/danielyxie/bitburner/blob/dev/doc/source/advancedgameplay/hackingalgorithms.rst
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
            server.fullHackThreads = Math.ceil(100 / Math.max(0.00000001, server.analyze));
            server.hackValue = server.moneyMax * (this.settings.minSecurityWeight / (server.minSecurityLevel + server.securityLevel));
            this.weightedServers.push(server);
        }
        this.weightedServers.sort((a, b) => b.hackValue - a.hackValue);
        const bestTarget = this.weightedServers[0];
        await this.loadHacks(); // after weightedServers is updated


        // decide which action to perform
        // - if security is not min then action=weaken
        // - elseif money is not max then action=hack
        // - else (action=hack)
        this.action = 'hack'; // standard attack
        if (bestTarget.securityLevel > bestTarget.minSecurityLevel + this.settings.minSecurityLevelOffset) {
            // security is too high, need to weaken
            this.action = 'weaken';
        } else if (bestTarget.moneyAvailable < bestTarget.moneyMax * this.settings.maxMoneyMultiplayer) {
            // money is too low, need to grow
            this.action = 'grow';
        }

        // calculate hacks time and number of threads we can run
        const hacks = this.hacks,
            weaken = hacks['weaken'],
            grow = hacks['grow'],
            hack = hacks['hack'];

        // TODO -- SORT THIS OUT
        function weakenThreadsForGrow(growThreads) {
            return Math.max(0, Math.ceil(growThreads * (grow.change / weaken.change)))
        }

        function weakenThreadsForHack(hackThreads) {
            return Math.max(0, Math.ceil(hackThreads * (hack.change / weaken.change)))
        }

        // build the attacks
        this.attacks = [];
        weaken.threads = weaken.maxThreads;
        grow.threads = grow.maxThreads;
        hack.threads = hack.maxThreads;
        this.ratioLog = '';
        switch (this.action) {

            // spawn threads to WEAKEN the target
            case 'weaken':
                // if there are more weaken threads than needed
                const requiredSecurityChange = bestTarget.securityLevel - bestTarget.minSecurityLevel;
                if (weaken.change * weaken.threads > requiredSecurityChange) {
                    // limit weaken threads
                    weaken.threads = Math.ceil(requiredSecurityChange / weaken.change);
                    // assign threads from grow to weaken
                    grow.threads = Math.max(0, grow.threads - weaken.threads);
                    weaken.threads += weakenThreadsForGrow(grow.threads);
                    grow.threads = Math.max(0, grow.threads - weakenThreadsForGrow(grow.threads));
                } else {
                    grow.threads = 0;
                }
                // log ratios and assign threads
                const securityReduction = Math.floor(weaken.change * weaken.threads * 1000) / 1000;
                this.ratioLog = `${grow.threads} grow threads; ${weaken.threads} weaken threads; expected security reduction: ${securityReduction}`;
                for (const server of hackingServers) {
                    let threadsFittable = Math.max(0, Math.floor((server.maxRam - server.ramUsed) / weaken.ram));
                    const threadsToRun = Math.max(0, Math.min(threadsFittable, grow.threads));
                    // grow threads
                    if (threadsToRun) {
                        //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock]
                        this.attacks.push([grow.script, server.hostname, threadsToRun, bestTarget.hostname, grow.delay]);
                        grow.threads -= threadsToRun;
                        threadsFittable -= threadsToRun;
                    }
                    // weaken threads
                    if (threadsFittable) {
                        //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock (ignored)]
                        this.attacks.push([weaken.script, server.hostname, threadsFittable, bestTarget.hostname, weaken.delay]);
                        weaken.threads -= threadsFittable;
                    }
                }
                break;

            // spawn threads to GROW the target
            case 'grow':
                // assign threads from grow to weaken
                weaken.threads = weakenThreadsForGrow(grow.threads);
                grow.threads -= weaken.threads;
                // log ratios and assign threads
                this.ratioLog = `${grow.threads} grow threads; ${weaken.threads} weaken threads`;
                for (const server of hackingServers) {
                    let threadsFittable = Math.max(0, Math.floor((server.maxRam - server.ramUsed) / grow.ram));
                    const threadsToRun = Math.max(0, Math.min(threadsFittable, grow.threads));
                    // grow threads
                    if (threadsToRun) {
                        //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock]
                        this.attacks.push([grow.script, server.hostname, threadsToRun, bestTarget.hostname, grow.delay]);
                        grow.threads -= threadsToRun;
                        threadsFittable -= threadsToRun;
                    }
                    // weaken threads
                    if (threadsFittable) {
                        //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock (ignored)]
                        this.attacks.push([weaken.script, server.hostname, threadsFittable, bestTarget.hostname, weaken.delay]);
                        weaken.threads -= threadsFittable;
                    }
                }
                break;

            // spawn threads to HACK the target
            case 'hack':
            default:
                // if there are more hack threads than needed
                if (hack.threads > bestTarget.fullHackThreads) {
                    // limit hack threads
                    hack.threads = bestTarget.fullHackThreads;
                    if (hack.threads * 100 < grow.threads) {
                        hack.threads *= 10;
                    }
                    // assign threads to grow/weaken
                    grow.threads = Math.max(0, grow.threads - Math.ceil((hack.threads * hack.ram) / grow.ram));
                    weaken.threads = weakenThreadsForGrow(grow.threads) + weakenThreadsForHack(hack.threads);
                    grow.threads = Math.max(0, grow.threads - weaken.threads);
                    hack.threads = Math.max(0, hack.threads - Math.ceil((weakenThreadsForHack(hack.threads) * weaken.ram) / hack.ram));
                } else {
                    // assign threads from hack to weaken
                    grow.threads = 0;
                    weaken.threads = weakenThreadsForHack(hack.threads);
                    hack.threads = hack.threads - Math.ceil((weaken.threads * weaken.ram) / hack.ram);
                }
                // log ratios and assign threads
                this.ratioLog = `${hack.threads} hack threads; ${grow.threads} grow threads; ${weaken.threads} weaken threads`;
                for (const server of hackingServers) {
                    let threadsFittable = Math.max(0, Math.floor((server.maxRam - server.ramUsed) / hack.ram));
                    const threadsToRun = Math.max(0, Math.min(threadsFittable, hack.threads));
                    // hack threads
                    if (hack.threads) {
                        //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock]
                        this.attacks.push([hack.script, server.hostname, threadsToRun, bestTarget.hostname, hack.delay]);
                        hack.threads -= threadsToRun;
                        threadsFittable -= threadsToRun;
                    }
                    // grow threads
                    const freeRam = (server.maxRam - server.ramUsed) - threadsToRun * grow.ram;
                    threadsFittable = Math.max(0, Math.floor(freeRam / grow.ram))
                    if (threadsFittable && grow.threads) {
                        const growThreadsToRun = Math.min(grow.threads, threadsFittable)
                        //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock]
                        this.attacks.push([grow.script, server.hostname, growThreadsToRun, bestTarget.hostname, grow.delay]);
                        grow.threads -= growThreadsToRun;
                        threadsFittable -= growThreadsToRun;
                    }
                    // weaken threads
                    if (threadsFittable) {
                        //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock (ignored)]
                        this.attacks.push([weaken.script, server.hostname, threadsFittable, bestTarget.hostname, weaken.delay]);
                        weaken.threads -= threadsFittable;
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
        // // quick fix to add attack scripts - remove this later, or make it a flag
        // const hackingServers = this.servers
        //     .filter(s => !s.hostname.includes('hacknet-')) // exclude hacknet-
        //     .filter(s => s.hasAdminRights); // include servers with root access
        // for (const server of hackingServers) {
        //     await this.runner.nsProxy['scp'](['/hacks/grow.js', '/hacks/hack.js', '/hacks/weaken.js'], server.hostname);
        // }
        // run the attack
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
        const ownedPortHacks = this.portHacks
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
            `Port Hacks: ${ownedPortHacks.length}/${this.portHacks.length} (${ownedPortHacks.map(a => a.exe).join(', ')})`,
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
            ` -> ${myServers.map(s => s.hostname + ' = ' + s.ramUsed + '/' + s.maxRam + 'GB free').join(', ')}`,
            '',
            `${this.weightedServers.length} servers have root access:`,
            ` -> ${this.weightedServers.map(s => s.hostname + ' = ' + this.ns.nFormat(s.hackValue, '$0.0a') + ' | ' + s.ramUsed + '/' + s.maxRam + 'GB free').join(', ')}`,
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
            '',
            `Best target is ${bestTarget.hostname}:`,
            ` -> ${this.ns.nFormat(bestTarget.hackValue, '$0.0a')}`,
            ` -> Action: ${this.action}`,
            ` -> Duration: ${this.ns.nFormat(this.hacks.weaken.time, '00:00:00')}`,
            ` -> Ratio: ${this.ratioLog}`,
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
                //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock]
                const baseUrl = `hbbp://${a[1]}${a[0].substr(-1) === '/' ? '' : '/'}${a[0]}?`;
                const params = [
                    `threads=${a[2]}`,
                    `target=${a[3]}`,
                ];
                if (a[4]) params.push(`delay=${Math.round(a[4] * 1000) / 1000}`);
                if (a[5]) params.push(`uuid=${a[5]}`);
                if (a[6]) params.push(`stock=${a[6]}`);
                hackingReport.push(' -> ' + baseUrl + params.join('&'));
            }
        }
        reports.push(hackingReport);

        // glue it together
        return reports.map(r => r.join("\n")).join("\n\n\n") + "\n\n\n";
    }

}