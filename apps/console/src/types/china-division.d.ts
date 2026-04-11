declare module "china-division/dist/pca-code.json" {
  const pcaC: Array<{
    code: string;
    name: string;
    children?: Array<{
      code: string;
      name: string;
      children?: Array<{ code: string; name: string }>;
    }>;
  }>;
  export default pcaC;
}
