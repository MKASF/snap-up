import * as puppeteer from 'puppeteer';

export async function gotoUrl(page: puppeteer.Page, url: string, options?: puppeteer.DirectNavigationOptions | undefined) {
  /** 进入页面前删除puppeteer的特征 */
  await page.evaluateOnNewDocument(() => {
    // @ts-ignore
    delete navigator.__proto__.webdriver;
  });
  await page.goto(url, options);
}

export async function getSnapUpUrl(page: puppeteer.Page): Promise<string> {
  let count = 0;
  return new Promise((resolve) => {
    const listener = async (response: puppeteer.Response) => {
      if (response.url().indexOf('https://itemko.jd.com/itemShowBtn') >= 0) {
        count++;
        console.log(page.url(), `获取链接次数${count}`);
        const text = await response.text();
        const data = parseJsonp(text);
        if (data.url) {
          page.off('response', listener);
          resolve('https:' + data.url);
        }
      }
    };
    page.on('response', listener);
  });
}

export function parseJsonp(data: string) {
  const start = data.indexOf('(') + 1;
  const end = data.lastIndexOf(')');
  return JSON.parse(data.slice(start, end));
}