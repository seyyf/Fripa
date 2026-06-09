import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  accountApi,
  clearAccountToken,
  getAccountToken,
  setAccountToken,
  type Account,
} from './accountApi';
import { LoginModal } from './LoginModal';

interface Ctx {
  user: Account | null;
  ready: boolean;
  openLogin: () => void;
  logout: () => void;
  setUser: (u: Account | null) => void;
  refresh: () => Promise<void>;
}

const noop = () => {};
const AccountCtx = createContext<Ctx>({
  user: null,
  ready: true,
  openLogin: noop,
  logout: noop,
  setUser: noop,
  refresh: async () => {},
});

export const useAccount = () => useContext(AccountCtx);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  async function refresh() {
    if (!getAccountToken()) {
      setUser(null);
      return;
    }
    try {
      setUser(await accountApi.me());
    } catch {
      clearAccountToken();
      setUser(null);
    }
  }

  useEffect(() => {
    refresh().finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function logout() {
    clearAccountToken();
    setUser(null);
  }

  return (
    <AccountCtx.Provider
      value={{ user, ready, openLogin: () => setLoginOpen(true), logout, setUser, refresh }}
    >
      {children}
      {loginOpen && (
        <LoginModal
          onClose={() => setLoginOpen(false)}
          onAuthed={(token, u) => {
            setAccountToken(token);
            setUser(u);
            setLoginOpen(false);
          }}
        />
      )}
    </AccountCtx.Provider>
  );
}
