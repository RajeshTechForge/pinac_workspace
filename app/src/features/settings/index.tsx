import { useState, useEffect, useContext } from "react";
import { LLMSelector } from "./components/LLMSelector";
import { AdvancedSettings } from "./components/AdvancedSettings";
import { AuthContext } from "@/contexts";
// Icons
import { IoLogOutOutline } from "react-icons/io5";
import { LuUpload } from "react-icons/lu";
import profileImage from "@/assets/icon/User Icon.png";

export const Settings = () => {
  const auth = useContext(AuthContext);
  const [displayName, setDisplayName] = useState<string>("");
  const [nickname, setNickname] = useState<string>("");
  const [emailId, setEmailId] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [tavilyApiKey, setTavilyApiKey] = useState<string>("");
  const [tavilySaveStatus, setTavilySaveStatus] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"app settings" | "profile">(
    "profile",
  );

  const handleLogout = () => {
    auth?.logout();
  };

  const saveUserInfo = () => {
    window.ipcRenderer.send("save-user-info", {
      displayName: displayName,
      nickname: nickname,
      email: emailId,
      photoURL: imageUrl,
    });
  };

  const saveTavilyApiKey = async () => {
    setTavilySaveStatus("Saving...");
    try {
      if (window.ipcRenderer) {
        const result = await window.ipcRenderer.invoke(
          "save-tavily-api-key",
          tavilyApiKey,
        );
        if (result.success) {
          setTavilySaveStatus("Saved!");
        } else {
          setTavilySaveStatus("Error!");
        }
      }
    } catch (error) {
      setTavilySaveStatus("Error!");
      console.error(error);
    }
    setTimeout(() => setTavilySaveStatus(""), 2000);
  };

  // Load user data on switching to this page
  useEffect(() => {
    window.ipcRenderer.send("get-user-info");
    window.ipcRenderer.once("backend-response", (_, response) => {
      setDisplayName(response.displayName || "");
      setNickname(response.nicname || "");
      setEmailId(response.email || "");
      setImageUrl(response.photoURL || null);
    });

    // Load Tavily API key
    if (window.ipcRenderer) {
      window.ipcRenderer
        .invoke("get-tavily-api-key")
        .then((key: string) => setTavilyApiKey(key || ""))
        .catch((err: any) =>
          console.error("Failed to load Tavily API key:", err),
        );
    }
  }, []);

  return (
    <div className="w-[710px] h-[500px] flex bg-gray-300 dark:bg-primary-dark text-gray-100 border-[0.1px] border-gray-400 dark:border-zinc-600 rounded-2xl">
      {/*       Sidebar       */}
      {/* ------------------- */}
      <div className="bg-secondary dark:bg-secondary-dark text-gray-100 p-6 rounded-l-2xl">
        <div className="mb-8 items-center font-normal font-cormorant text-3xl">
          Settings
          <div className="w-full border border-gray-300 dark:border-gray-600" />
        </div>

        <nav className="space-y-2">
          <button
            onClick={() => setActiveTab("profile")}
            className={`w-full text-left px-4 py-2 rounded-lg flex items-center ${
              activeTab === "profile"
                ? "bg-violet-700"
                : "hover:bg-gray-700/70 dark:hover:bg-zinc-700/60"
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab("app settings")}
            className={`w-full text-left px-4 py-2 rounded-lg flex items-center ${
              activeTab === "app settings"
                ? "bg-violet-700"
                : "hover:bg-gray-700/70 dark:hover:bg-zinc-700/60"
            }`}
          >
            AI Models
          </button>
        </nav>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-4">
        {activeTab === "profile" ? (
          //
          //         Profile Settings         //
          //----------------------------------//
          <div className="w-full h-full bg-secondary dark:bg-secondary-dark rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center border-b pb-4 mb-6">
              <h2 className="text-xl font-semibold">Profile Settings</h2>
              <button
                className="flex items-center px-4 py-2 bg-red-500 text-sm text-gray-100 rounded-lg hover:bg-red-600 cursor-pointer"
                onClick={handleLogout}
              >
                <IoLogOutOutline size={20} className="mr-1.5" />
                Log Out
              </button>
            </div>

            {/* Profile Photo */}
            <div className="mb-7 rounded-full flex items-center">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  className="size-28 object-fill overflow-hidden"
                  alt="Profile Picture"
                />
              ) : (
                <img
                  src={profileImage}
                  className="size-28 object-fill overflow-hidden"
                  alt="Profile Picture"
                />
              )}
              <label className="ml-4 px-4 py-2 text-sm bg-violet-700 text-gray-100 rounded-lg hover:bg-violet-800 cursor-pointer flex items-center">
                <LuUpload size={18} className="mr-1.5" />
                Upload Photo
                <input type=".png, .jpg, .jpeg" className="hidden" />
              </label>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <form className="flex flex-col gap-3 w-full py-5 rounded-xl relative">
                <div className="flex gap-3 w-full p-0 m-0">
                  <label className="relative w-full">
                    <input
                      required
                      placeholder=" "
                      type="text"
                      className="peer w-full p-2.5 pb-5 outline-none rounded-xl transition-all duration-300
                    text-gray-200 dark:text-gray-200 bg-gray-800 dark:bg-primary-dark border border-gray-600 dark:border-zinc-700 shadow-md
                    "
                      value={displayName}
                      onChange={(event) => {
                        setDisplayName(event.target.value);
                      }}
                    />
                    <span
                      className="absolute left-2.5 top-4 text-gray-500 dark:text-zinc-500 text-sm cursor-text transition-all duration-300 peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm 
                    peer-focus:top-8 peer-focus:text-xs peer-focus:font-semibold peer-valid:top-8 peer-valid:text-xs peer-valid:font-semibold peer-valid:text-green-600"
                    >
                      Full Name
                    </span>
                  </label>

                  <label className="relative w-full">
                    <input
                      required
                      placeholder=" "
                      type="text"
                      className="peer w-full p-2.5 pb-5 outline-none rounded-xl  transition-all duration-300
                    text-gray-200 dark:text-gray-200 bg-gray-800 dark:bg-primary-dark border border-gray-600 dark:border-zinc-700
                    "
                      value={nickname}
                      onChange={(event) => {
                        setNickname(event.target.value);
                      }}
                    />
                    <span
                      className="absolute left-2.5 top-4 text-gray-500 dark:text-zinc-500 text-sm cursor-text transition-all duration-300 peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm 
                    peer-focus:top-8 peer-focus:text-xs peer-focus:font-semibold peer-valid:top-8 peer-valid:text-xs peer-valid:font-semibold peer-valid:text-green-600"
                    >
                      What should I call You ?
                    </span>
                  </label>
                </div>

                <label className="relative w-full">
                  <input
                    required
                    placeholder=" "
                    type="email"
                    className="peer w-full p-2.5 pb-5 outline-none rounded-xl  transition-all duration-300
                    text-gray-200 dark:text-gray-200 bg-gray-800 dark:bg-primary-dark border border-gray-600 dark:border-zinc-700
                    "
                    value={emailId}
                    onChange={(event) => {
                      setEmailId(event.target.value);
                    }}
                  />
                  <span
                    className="absolute left-2.5 top-4 text-gray-500 dark:text-zinc-500 text-sm cursor-text transition-all duration-300 peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm 
                    peer-focus:top-8 peer-focus:text-xs peer-focus:font-semibold peer-valid:top-8 peer-valid:text-xs peer-valid:font-semibold peer-valid:text-green-600"
                  >
                    Email
                  </span>
                </label>
                {/* Submit Button */}
                <button
                  className="w-full p-3 border-none rounded-xl outline-none cursor-pointer
                  bg-violet-700 dark:bg-gray-100 text-gray-100 dark:text-gray-800 hover:bg-violet-800 dark:hover:bg-gray-300"
                  onClick={() => {
                    saveUserInfo();
                  }}
                >
                  Save Changes
                </button>
              </form>
            </div>
          </div>
        ) : (
          //         App Settings         //
          //------------------------------//
          <div className="w-full h-full bg-secondary dark:bg-secondary-dark rounded-lg shadow-md p-6 scrollbar">
            {/*     Section 1 (Select LLM)      */}
            {/* =============================== */}
            <div className="w-full py-5 px-2 flex flex-col items-center">
              <div className="w-full text-lg pb-7 text-gray-200">
                Select LLM
              </div>
              <LLMSelector />
            </div>

            {/*   Section 2 (Advanced Settings)  */}
            {/* ================================= */}
            <div className="w-full py-5 px-2 flex flex-col items-center">
              <AdvancedSettings />
            </div>

            {/*   Section 3 (Tavily API Key)  */}
            {/* ============================== */}
            <div className="w-full py-5 px-2 flex flex-col items-center">
              <div className="w-full flex flex-col gap-4 p-4 bg-gray-800 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-200">
                  Web Search Settings
                </h3>
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-gray-300">
                    Tavily API Key
                  </label>
                  <input
                    type="password"
                    className="w-full h-9 px-2 rounded-lg bg-gray-700 dark:bg-tertiary-dark text-gray-200 outline-none"
                    value={tavilyApiKey}
                    onChange={(e) => setTavilyApiKey(e.target.value)}
                    placeholder="Enter Tavily API Key"
                  />
                  <p className="text-xs text-gray-400">
                    Required for web search functionality. Get your key from{" "}
                    <a
                      href="https://tavily.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      tavily.com
                    </a>
                  </p>
                </div>
                <button
                  onClick={saveTavilyApiKey}
                  className={`mt-2 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium
                    ${tavilySaveStatus === "Saved!" ? "bg-green-600 hover:bg-green-700" : ""}
                    ${tavilySaveStatus === "Error!" ? "bg-red-600 hover:bg-red-700" : ""}
                  `}
                >
                  {tavilySaveStatus || "Save API Key"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
