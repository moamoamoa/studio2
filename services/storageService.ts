import { ChatRoom, Message, Memo, UserRole } from '../types';
import { initializeApp, FirebaseApp, deleteApp } from 'firebase/app';
import { 
  getDatabase, 
  ref, 
  set, 
  remove, 
  onValue, 
  runTransaction,
  Database
} from 'firebase/database';

const ROOMS_KEY = 'ai_automation_rooms';
const FIREBASE_CONFIG_KEY = 'ai_automation_firebase_config';

let firebaseApp: FirebaseApp | null = null;
let db: Database | null = null;
let isCloudEnabled = false;

// Interface for Firebase Config
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL?: string; // Essential for Realtime DB
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

// --- Initialization ---

export const getFirebaseConfig = (): FirebaseConfig | null => {
  try {
    const stored = localStorage.getItem(FIREBASE_CONFIG_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const testFirebaseConnection = async (config: FirebaseConfig): Promise<void> => {
  let testApp: FirebaseApp | null = null;
  try {
    // Unique app name to avoid conflicts
    const appName = `test-app-${Date.now()}`;
    testApp = initializeApp(config, appName);
    const testDb = getDatabase(testApp);
    
    // Check connection using .info/connected
    const connectedRef = ref(testDb, '.info/connected');
    
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("연결 시간 초과 (5초). 인터넷 연결이나 설정을 확인해주세요."));
      }, 5000);

      const unsubscribe = onValue(connectedRef, (snapshot) => {
        const connected = snapshot.val();
        if (connected === true) {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        }
      }, (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

  } catch (error: any) {
    console.error("Firebase connection test failed:", error);
    throw new Error(error.message || "Firebase 연결에 실패했습니다.");
  } finally {
    if (testApp) {
      try {
        await deleteApp(testApp);
      } catch (e) {
        console.error("Error cleaning up test app:", e);
      }
    }
  }
};

export const saveFirebaseConfig = (config: FirebaseConfig) => {
  localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
  // Reload to apply changes
  window.location.reload();
};

export const clearFirebaseConfig = () => {
  try {
    localStorage.removeItem(FIREBASE_CONFIG_KEY);
    // Force hard reload to clear state
    window.location.href = '/';
  } catch (e) {
    console.error("Error clearing config:", e);
    window.location.reload();
  }
};

const initFirebase = () => {
  const config = getFirebaseConfig();
  if (config) {
    try {
      firebaseApp = initializeApp(config);
      // Initialize Realtime Database
      db = getDatabase(firebaseApp);
      isCloudEnabled = true;
      console.log("Firebase Realtime Database initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Firebase", error);
      isCloudEnabled = false;
    }
  }
};

// Initialize immediately
initFirebase();

export const isCloudMode = () => isCloudEnabled;

// --- Data Access (Hybrid: Local vs Cloud) ---

// 1. Subscription (Real-time listener)
export const subscribeToRooms = (callback: (rooms: ChatRoom[]) => void): () => void => {
  if (isCloudEnabled && db) {
    // Cloud Mode: Listen to Realtime DB 'rooms' node
    const roomsRef = ref(db, 'rooms');
    const unsubscribe = onValue(roomsRef, (snapshot) => {
      const data = snapshot.val();
      // RTDB stores as Object { key: val }, we need Array [val]
      if (data) {
        // Sanitize data: Ensure arrays are actual arrays (RTDB might convert sparse arrays to objects)
        const roomsList: ChatRoom[] = Object.values(data).map((r: any) => ({
          ...r,
          messages: r.messages ? Object.values(r.messages) : [],
          memos: r.memos ? Object.values(r.memos) : []
        }));
        callback(roomsList);
      } else {
        callback([]);
      }
    }, (error) => {
      console.error("RTDB sync error:", error);
    });
    return unsubscribe;
  } else {
    // Local Mode: Listen to window storage events + Initial load
    const loadLocal = () => {
      const stored = localStorage.getItem(ROOMS_KEY);
      const rooms = stored ? JSON.parse(stored) : [];
      callback(rooms);
    };

    loadLocal(); // Initial call

    const handleStorage = () => loadLocal();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('storage-local', handleStorage); // Custom event

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('storage-local', handleStorage);
    };
  }
};

// 2. Write Operations

const notifyLocalChanges = () => {
  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new Event('storage-local'));
};

export const saveRoom = async (room: ChatRoom) => {
  if (isCloudEnabled && db) {
    try {
      // RTDB set replaces the data at the path
      // Sanitize room object to remove undefined values (which Firebase rejects)
      const sanitizedRoom = JSON.parse(JSON.stringify(room));
      await set(ref(db, `rooms/${room.id}`), sanitizedRoom);
    } catch (e) {
      console.error("Error saving room to cloud:", e);
      throw e; // Re-throw to handle in caller
    }
  } else {
    const rooms = getLocalRooms();
    const existingIndex = rooms.findIndex((r) => r.id === room.id);
    if (existingIndex >= 0) {
      rooms[existingIndex] = room;
    } else {
      rooms.push(room);
    }
    localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
    notifyLocalChanges();
  }
};

export const deleteRoom = async (roomId: string) => {
  if (isCloudEnabled && db) {
    try {
      await remove(ref(db, `rooms/${roomId}`));
    } catch (e) {
      console.error("Error deleting room from cloud:", e);
      throw e;
    }
  } else {
    const rooms = getLocalRooms();
    const updatedRooms = rooms.filter((r) => String(r.id) !== String(roomId));
    localStorage.setItem(ROOMS_KEY, JSON.stringify(updatedRooms));
    notifyLocalChanges();
  }
};

export const createRoom = async (title: string, password?: string): Promise<ChatRoom> => {
  const now = new Date();
  const dateText = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;

  // Use crypto randomUUID if available, otherwise fallback
  let uniqueId;
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    uniqueId = crypto.randomUUID();
  } else {
    uniqueId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  const newRoom: ChatRoom = {
    id: uniqueId,
    title,
    password,
    messages: [
      {
        id: Math.random().toString(36),
        senderName: 'System',
        role: UserRole.ADMIN,
        text: dateText,
        timestamp: Date.now(),
        type: 'system',
      },
    ],
    memos: [],
    createdAt: Date.now(),
    createdBy: 'AI Bot',
  };
  
  // Await save to ensure it's written before proceeding
  await saveRoom(newRoom);
  return newRoom;
};

// Use Transactions for adding items in RTDB to prevent overwrites in concurrent usage
export const addMessage = (roomId: string, message: Message) => {
  if (isCloudEnabled && db) {
     const roomRef = ref(db, `rooms/${roomId}`);
     runTransaction(roomRef, (room) => {
       if (room) {
         if (!room.messages) room.messages = [];
         // RTDB stores arrays as objects if keys are numeric, but push usually works fine for pure arrays
         // However, ensure we treat it as array in JS
         const messages = Array.isArray(room.messages) ? room.messages : Object.values(room.messages);
         messages.push(message);
         room.messages = messages;
       }
       return room;
     });
  } else {
    const rooms = getLocalRooms();
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      room.messages.push(message);
      saveRoom(room);
    }
  }
};

export const addMemo = (roomId: string, memo: Memo) => {
  if (isCloudEnabled && db) {
     const roomRef = ref(db, `rooms/${roomId}`);
     runTransaction(roomRef, (room) => {
       if (room) {
         if (!room.memos) room.memos = [];
         const memos = Array.isArray(room.memos) ? room.memos : Object.values(room.memos);
         memos.push(memo);
         room.memos = memos;
       }
       return room;
     });
  } else {
    const rooms = getLocalRooms();
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      room.memos.push(memo);
      saveRoom(room);
    }
  }
};

export const deleteMemo = (roomId: string, memoId: string) => {
  if (isCloudEnabled && db) {
     const roomRef = ref(db, `rooms/${roomId}`);
     runTransaction(roomRef, (room) => {
       if (room) {
         if (!room.memos) return room;
         const memos = Array.isArray(room.memos) ? room.memos : Object.values(room.memos);
         room.memos = memos.filter((m: Memo) => m.id !== memoId);
       }
       return room;
     });
  } else {
    const rooms = getLocalRooms();
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      room.memos = room.memos.filter(m => m.id !== memoId);
      saveRoom(room);
    }
  }
};

// --- Helpers ---
export const getLocalRooms = (): ChatRoom[] => {
  try {
    const stored = localStorage.getItem(ROOMS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Failed to parse rooms from localStorage", error);
    return [];
  }
};

export const getRooms = getLocalRooms;

export const importRoom = (roomData: ChatRoom): boolean => {
  try {
    if (!roomData || !roomData.id || !roomData.title) return false;
    saveRoom(roomData);
    return true;
  } catch (e) {
    return false;
  }
};