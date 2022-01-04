import {BaseComponent} from "/components/BaseComponent";

/**
 * Cache
 *
 * Uses localStorage to store and retrieve cached data.
 * - Automatically stringify/parse data before and after saving.
 * - Allows data to expire after a given time.
 */
export class Cache extends BaseComponent {

    /**
     * Construct the component
     *
     * @param {Object} config - key/value pairs used to set object properties
     */
    constructor(config = {}) {
        super(config);
        // allow override of properties in this class
        Object.entries(config).forEach(([key, value]) => this[key] = value);
    }

    /**
     * Returns the current value associated with the given key, or null if the given key does not exist.
     * @param key
     * @returns {any}
     */
    getItem(key) {
        //BBFW.app.logger.log(`cache.getItem(${key})`, true);
        let contents = localStorage.getItem(key)
        if (contents) {
            let data = JSON.parse(contents);
            if (!data.expires || data.expires > new Date().getTime()) {
                return data.value;
            }
        }
        return undefined;
    }

    /**
     * Sets the value of the pair identified by key to value, creating a new key/value pair if none existed for key previously.
     * @param key
     * @param value
     * @param expires in milliseconds, 0 = forever
     */
    setItem(key, value, expires) {
        let data = {
            expires: expires ? new Date().getTime() + expires : 0,
            value: typeof value === 'function' ? value() : value, // if value is a function then use the returned value
        };
        let contents = JSON.stringify(data);
        //BBFW.app.logger.log(`cache.setItem (expires=${expires}) ${key} = ${contents}`, true);
        localStorage.setItem(key, contents);
    }

    /**
     * Removes the key/value pair with the given key, if a key/value pair with the given key exists.
     * @param key
     */
    removeItem(key) {
        localStorage.removeItem(key);
    }

    /**
     * Removes all key/value pairs, if there are any.
     */
    clear() {
        localStorage.clear();
    }

}