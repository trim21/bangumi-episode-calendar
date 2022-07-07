import axios from "axios";

export const client = axios.create({ baseURL: "https://api.bgm.tv/v0/", headers: { "user-agent": "bangumi-contrib" } });
