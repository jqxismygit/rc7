import pcaC from "china-division/dist/pca-code.json";

type RawNode = {
  code: string;
  name: string;
  children?: RawNode[];
};

export type RegionCascaderOption = {
  value: string;
  label: string;
  children?: RegionCascaderOption[];
};

function toAntdOptions(nodes: RawNode[]): RegionCascaderOption[] {
  return nodes.map((n) => ({
    value: n.code,
    label: n.name,
    children:
      n.children && n.children.length > 0
        ? toAntdOptions(n.children)
        : undefined,
  }));
}

/** 省 / 市 / 区三级，value 为各级区划代码（区县 leaf 为 6 位国标码） */
export const CHINA_REGION_CASCADER_OPTIONS = toAntdOptions(pcaC as RawNode[]);

/** 区县 code -> 「省 / 市 / 区」展示文案 */
export function buildLeafRegionLabelMap(
  nodes: RawNode[],
  prefix: string[] = [],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const n of nodes) {
    const path = [...prefix, n.name];
    if (n.children?.length) {
      const sub = buildLeafRegionLabelMap(n.children, path);
      sub.forEach((v, k) => map.set(k, v));
    } else {
      map.set(n.code, path.join(" / "));
    }
  }
  return map;
}

const LEAF_LABEL_MAP = buildLeafRegionLabelMap(pcaC as RawNode[]);

export function getRegionLabelByLeafCode(
  code: string | null | undefined,
): string {
  if (code == null || code === "") return "—";
  const hit = LEAF_LABEL_MAP.get(code.trim());
  if (hit) return hit;
  return code;
}

function findPath(
  nodes: RawNode[],
  targetLeaf: string,
  acc: string[],
): string[] | null {
  const t = targetLeaf.trim();
  for (const n of nodes) {
    const next = [...acc, n.code];
    if (n.code === t) return next;
    if (n.children?.length) {
      const sub = findPath(n.children, t, next);
      if (sub) return sub;
    }
  }
  return null;
}

/** 根据区县代码还原级联 value 路径；仅当 code 为库中存在的 leaf 时有效 */
export function getCascaderValuePathByLeafCode(
  leafCode: string | null | undefined,
): string[] | undefined {
  if (leafCode == null || !/^\d{6}$/.test(leafCode.trim())) return undefined;
  const path = findPath(pcaC as RawNode[], leafCode.trim(), []);
  return path ?? undefined;
}
