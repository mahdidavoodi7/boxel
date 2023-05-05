import Service from '@ember/service';
import { createClient } from 'matrix-js-sdk';
import { type IAuthData } from 'matrix-js-sdk';
import { tracked } from '@glimmer/tracking';
import ENV from '@cardstack/host/config/environment';

const { matrixURL } = ENV;

export default class MatrixService extends Service {
  @tracked
  client = createClient({ baseUrl: matrixURL });

  get isLoggedIn() {
    return this.client.isLoggedIn();
  }
  get userId() {
    return this.client.getUserId();
  }

  async logout() {
    clearAuth();
    await this.client.logout();
    this.client = createClient({ baseUrl: matrixURL });
  }

  async start() {
    let auth = getAuth();
    if (!auth) {
      return;
    }

    let { access_token: accessToken, user_id: userId } = auth;
    this.client = createClient({ baseUrl: matrixURL, accessToken, userId });
    if (this.isLoggedIn) {
      await this.client.startClient();
    }
  }

  async startWithAuth(auth: IAuthData): Promise<void> {
    let { access_token: accessToken, user_id: userId } = auth;
    if (!accessToken) {
      throw new Error(
        `Cannot create matrix client from auth that has no access token: ${JSON.stringify(
          auth,
          null,
          2
        )}`
      );
    }
    if (!userId) {
      throw new Error(
        `Cannot create matrix client from auth that has no user id: ${JSON.stringify(
          auth,
          null,
          2
        )}`
      );
    }
    this.client = createClient({ baseUrl: matrixURL, accessToken, userId });
    await this.client.startClient();
    saveAuth(auth);
  }
}

function saveAuth(auth: IAuthData) {
  localStorage.setItem('auth', JSON.stringify(auth));
}

function clearAuth() {
  localStorage.removeItem('auth');
}

function getAuth(): IAuthData | undefined {
  let auth = localStorage.getItem('auth');
  if (!auth) {
    return;
  }
  return JSON.parse(auth) as IAuthData;
}
