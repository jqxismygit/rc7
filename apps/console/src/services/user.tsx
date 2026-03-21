import { getProfile } from "@/apis/user";
import React, { useEffect } from "react";

type UserServiceContextType = {
  profile: any | null;
};

export const UserServiceContext = React.createContext<UserServiceContextType>(
  {} as UserServiceContextType,
);

export const useUserService = () => {
  const context = React.useContext(UserServiceContext);
  if (!context) {
    throw new Error("useUserService must be used within a UserServiceProvider");
  }
  return context;
};

export const UserServiceProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [profile, setProfile] = React.useState<any | null>(null);

  useEffect(() => {
    getProfile()
      .then((res) => setProfile(res as any))
      .catch(() => setProfile(null));
  }, []);
  return (
    <UserServiceContext.Provider value={{ profile }}>
      {children}
    </UserServiceContext.Provider>
  );
};
