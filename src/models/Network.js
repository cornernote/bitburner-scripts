/**
 * Network
 */

export class Network {



    /**
     * @type {Runner}
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
