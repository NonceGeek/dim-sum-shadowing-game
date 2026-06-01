import React from "react";

const DEFAULT_AVATAR_SRC = "/default_avatar.png";

const UserProfile = () => {
  return (
    <div className="user-profile-wrapper flex mx-5 py-4 items-center">
      <div
        id="avator"
        className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-amber-100 ring-2 ring-amber-300"
      >
        <img
          src={DEFAULT_AVATAR_SRC}
          alt="Default avatar"
          className="h-full w-full object-cover"
        />
      </div>
      <div className="ml-3">你好，探险家❤️! </div>
    </div>
  );
};

export default UserProfile;
