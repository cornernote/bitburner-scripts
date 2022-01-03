import {BaseComponent} from "/includes/BaseComponent";

/**
 * Cache
 *
 * Uses localStorage to store and retrieve cached data.
 * - Automatically stringify/parse data before and after saving.
 * - Allows data to expire after a given time.
 */
export class Cache extends BaseComponent {

    /**
     * Returns the current value associated with the given key, or null if the given key does not exist.
     * @param key
     * @returns {any}
     */
    getItem(key) {
        //this.app.logger.log(`cache.getItem(${key})`, true);
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
        //this.app.logger.log(`cache.setItem (expires=${expires}) ${key} = ${contents}`, true);
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
     * Returns the number of key/value pairs.
     * @returns {number}
     */
    getLength() {
        return localStorage.length;
    }

    /**
     * Returns the name of the nth key, or null if n is greater than or equal to the number of key/value pairs.
     * @param index
     * @returns {string}
     */
    key(index) {
        return localStorage.key(index);
    }

    /**
     * Removes all key/value pairs, if there are any.
     */
    clear() {
        localStorage.clear();
    }

}