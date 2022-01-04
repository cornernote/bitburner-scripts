import {BaseComponent} from "/components/BaseComponent";
import {Player} from "/models/Player";
import {Server} from "/models/Server";
import {TaskManager} from "/components/TaskManager";

/**
 * Network
 */

export class Network extends BaseComponent {

    /**
     * Construct the component
     * @param {Application} app - the application instance created in the entry script
     * @param {Object} config - key/value pairs used to set object properties
     */
    constructor(app, config = {}) {
        super(app, config);
        // allow override of properties in this class
        Object.entries(config).forEach(([key, value]) => this[key] = value);
    }


    /**
     * TODO - move this to application, but only sometimes, so we only pay the RAM cost when we need...
     *
     * @type {TaskManager}
     */
    taskManager


    /**
     * @type {Player}
     */
    player

    /**
     * @type {Server[]}
     */
    servers = []

    /**
     * Updates the data
     */
    async loadData() {
        await this.loadPlayer();
        await this.loadServers();
    }

    /**
     * Updates the player data
     */
    async loadPlayer() {
        this.player = new Player();
        await this.player.loadData();
    }

    /**
     * Updates the server list
     */
    async loadServers() {

        let servers = ["home"],
            routes = {home: ["home"]};

        let myHackingLevel = await this.taskManager.backgroundNS('getHackingLevel');  //@BGRAM 0.05GB

        // Scan all servers and keep track of the path to get to them
        for (let i = 0, j; i < servers.length; i++) {
            for (j of await this.taskManager.backgroundNS('scan', servers[i])) {
                if (!servers.includes(j)) {
                    servers.push(j);
                    routes[j] = routes[servers[i]].slice();
                    routes[j].push(j);
                }
            }
        }

    }

}
