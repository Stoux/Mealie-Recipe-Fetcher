import axios from "axios";

export class Mealie {

    constructor(host, token) {
        this.api = axios.create({
            baseURL: host + '/api/',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        })
    }

    /**
     * @param url
     * @returns {Promise<boolean>}
     */
    async recipeAlreadyExists(url) {
        const response = await this.api.get('recipes', {
            data: {
                queryFilter: `orgURL=${url}`,
                perPage: 1000,
            }
        });

        return response.data.items.some(item => item.orgURL === url);
    }

    /**
     *
     * @param json
     * @returns {Promise<string>} Slug of the new recipe
     */
    async importRecipe(json) {
        const response = await this.api.post(`recipes/create/html-or-json`, {
            data: JSON.stringify(json),
        })

        return response.data;
    }

    async updateRecipe(slug, data) {
        await this.api.patch(`recipes/${slug}`, data)
    }



}
