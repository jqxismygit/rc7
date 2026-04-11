import fs from 'fs/promises';
import path from 'node:path';

const __dirname = new URL('.', import.meta.url).pathname;
const city_file_path = path.resolve(__dirname, '../../static/cities.json');

export type CityMeta = {
  id: string;
  name: string;
};

function loadCityList(): Promise<[string, string][]> {
  return fs.readFile(city_file_path, 'utf-8')
  .then((data: string) => JSON.parse(data));
}

export async function getCityMetaByName(cityName: string): Promise<CityMeta | null> {
  const normalized = cityName.trim();
  if (!normalized) {
    return null;
  }

  const cityList: [string, string][] = await loadCityList();
  const city = cityList.find(([_, name]) => name === normalized);
  if (!city) {
    return null;
  }

  const [id, name] = city;
  return { id, name };
}

export async function getCityMetaById(cityId: string): Promise<CityMeta | null> {
  const cityList: [string, string][] = await loadCityList();
  const city = cityList.find(([id]) => id === cityId);
  if (!city) {
    return null;
  }

  const [id, name] = city;
  return { id, name };
}