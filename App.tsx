import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bot, Users, Plus, LayoutGrid, Search, Shield, Trash2, LogOut, Upload, Download, HardDrive, Cloud, CloudOff } from 'lucide-react';
import { ChatRoom, UserSession, UserRole } from './types';
import { 
  createRoom, 
  deleteRoom, 
  subscribeToRooms, 
  isCloudMode, 
  saveFirebaseConfig,
  clearFirebaseConfig,
  FirebaseConfig,
  importRoom
} from './services/storageService';
import { CreateRoomModal } from './components/CreateRoomModal';
import { JoinRoomModal } from './components/JoinRoomModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { DeleteRoomModal } from './components/DeleteRoomModal';
import { CloudSetupModal } from './components/CloudSetupModal';
import { DisconnectCloudModal } from './components/DisconnectCloudModal';
import { ChatInterface } from './components/ChatInterface';
import { Button } from './components/Button';
import { APP_NAME, AVATARS } from './constants';

const App: React.FC = () => {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [currentRoom, setCurrentRoom] = useState<ChatRoom | null>(null);
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [joinModalRoom, setJoinModalRoom] = useState<ChatRoom | null>(null);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showCloudSetup, setShowCloudSetup] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  
  // State for delete confirmation modal
  const [roomToDelete, setRoomToDelete] = useState<string | null>(null);
  
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isCloud = isCloudMode();

  // Subscribe to room updates (Real-time or Local Storage events)
  useEffect(() => {
    // This function returns an unsubscribe method (cleaner)
    const unsubscribe = subscribeToRooms((updatedRooms) => {
      setRooms(updatedRooms.sort((a, b) => b.createdAt - a.createdAt));
      
      // If inside a room, update the currentRoom state as well to reflect new messages immediately
      if (currentRoom) {
        const updatedCurrent = updatedRooms.find(r => r.id === currentRoom.id);
        if (updatedCurrent) {
          setCurrentRoom(updatedCurrent);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentRoom]);

  // Update room wrapper to trigger re-renders and local updates
  const handleRoomUpdate = () => {
    // Logic handled by subscription now
  };

  const handleCreateRoom = async (title: string, password?: string) => {
    try {
      // 1. Create Room (Service generates unique ID)
      const newRoom = await createRoom(title, password);
      setShowCreateModal(false);
      
      // Auto join as Admin
      const session: UserSession = {
        username: 'AI Bot',
        role: UserRole.ADMIN,
      };
      setCurrentUser(session);
      setCurrentRoom(newRoom);
    } catch (error) {
      console.error("Failed to create room:", error);
      alert("방 생성에 실패했습니다. 클라우드 연결 상태를 확인해주세요.");
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, roomId: string) => {
    // 1. Stop Propagation: Prevent clicking the card behind the button
    e.preventDefault();
    e.stopPropagation();
    
    // 2. Open Custom Modal instead of window.confirm
    setRoomToDelete(roomId);
  };

  const handleConfirmDelete = () => {
    if (roomToDelete) {
      // 3. Delete Data
      deleteRoom(roomToDelete);
      // Subscription will update the UI
      setRoomToDelete(null);
    }
  };

  // Export Room Logic
  const handleExportRoom = (e: React.MouseEvent, room: ChatRoom) => {
    e.stopPropagation();
    e.preventDefault();
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(room));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${room.title.replace(/\s+/g, '_')}_data.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  // Import Room Logic
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const success = importRoom(json);
        if (success) {
          alert("방을 성공적으로 불러왔습니다!");
        } else {
          alert("유효하지 않은 방 데이터 파일입니다.");
        }
      } catch (err) {
        console.error(err);
        alert("파일을 읽는 중 오류가 발생했습니다.");
      }
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleSaveFirebase = (config: FirebaseConfig) => {
    saveFirebaseConfig(config);
  };

  const handleDisconnectCloud = () => {
    setShowDisconnectModal(true);
  };

  const confirmDisconnect = () => {
    clearFirebaseConfig();
    setShowDisconnectModal(false);
  };

  const handleJoinRoom = (room: ChatRoom) => {
    if (isAdminMode) {
      setCurrentUser({
        username: 'AI Bot',
        role: UserRole.ADMIN,
      });
      setCurrentRoom(room);
    } else {
      setJoinModalRoom(room);
    }
  };

  const confirmJoin = (nickname: string, password?: string) => {
    if (joinModalRoom) {
      setCurrentUser({
        username: nickname,
        role: UserRole.PARTICIPANT,
      });
      setCurrentRoom(joinModalRoom);
      setJoinModalRoom(null);
    }
  };

  const handleExitRoom = () => {
    setCurrentRoom(null);
    setCurrentUser(null);
  };

  const filteredRooms = rooms.filter(room => 
    room.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (currentRoom && currentUser) {
    return (
      <ChatInterface 
        room={currentRoom} 
        session={currentUser} 
        onExit={handleExitRoom}
        onUpdateRoom={handleRoomUpdate}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 overflow-hidden p-0.5">
               <img src={AVATARS.admin} alt="AI Logo" className="w-full h-full object-contain p-1 rounded-xl bg-white" />
             </div>
             <div>
               <h1 className="text-xl font-bold text-slate-800 tracking-tight leading-none">{APP_NAME}</h1>
               <div className={`flex items-center gap-1 mt-1 text-[10px] px-1.5 py-0.5 rounded-md w-fit border cursor-pointer hover:opacity-80 transition-opacity ${isCloud ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-600 border-amber-100'}`}
                 onClick={() => !isCloud && setShowCloudSetup(true)}
                 title={isCloud ? "Connected to Cloud" : "Data saved locally"}
               >
                 {isCloud ? <Cloud size={10} /> : <HardDrive size={10} />}
                 <span>{isCloud ? 'Cloud Connected' : 'Local Storage Mode'}</span>
               </div>
             </div>
          </div>
          <div className="flex items-center gap-4">
             {/* Cloud Setup Button (Visible to everyone for easy setup) */}
             {isCloud ? (
               <button 
                  onClick={handleDisconnectCloud}
                  className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-full transition-colors"
                  title="Disconnect Cloud"
                >
                  <CloudOff size={18} />
               </button>
             ) : (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowCloudSetup(true)}
                  className="text-slate-500 hover:text-indigo-600"
                >
                  <Cloud size={18} className="mr-2" />
                  Connect Cloud
                </Button>
             )}
            
            <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block"></div>

            {!isAdminMode ? (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowAdminLogin(true)}
                className="text-slate-500 hover:text-indigo-600"
              >
                <Shield size={18} className="mr-2" />
                Admin Access
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                 <input 
                   type="file" 
                   ref={fileInputRef} 
                   onChange={handleFileChange} 
                   accept=".json" 
                   className="hidden" 
                 />
                 <Button 
                   variant="ghost" 
                   size="sm"
                   onClick={handleImportClick}
                   className="text-slate-500 hover:text-indigo-600 hidden sm:flex"
                   title="Import Room from JSON file"
                 >
                   <Upload size={18} className="mr-2" />
                   Import Room
                 </Button>

                 <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block"></div>

                 <button 
                  onClick={() => setIsAdminMode(false)}
                  className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full border border-indigo-100 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors group"
                  title="Click to exit Admin Mode"
                >
                  <Shield size={14} className="group-hover:hidden" />
                  <LogOut size={14} className="hidden group-hover:block" />
                  <span className="text-xs font-bold uppercase tracking-wide group-hover:hidden">Admin Mode</span>
                  <span className="text-xs font-bold uppercase tracking-wide hidden group-hover:inline">Exit Admin</span>
                </button>
              </div>
            )}

            <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block"></div>

            {isAdminMode ? (
              <Button 
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={18} className="mr-2" />
                New Room
              </Button>
            ) : null}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-6">
        
        {/* Search & Header */}
        <div className="mb-8 text-center space-y-4">
           <h2 className="text-3xl font-bold text-slate-800">
             Explore Rooms
           </h2>
           
           <div className="relative max-w-md mx-auto mt-6 group">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
             <input 
               type="text"
               placeholder="Search rooms..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 outline-none transition-all shadow-sm"
             />
           </div>
        </div>

        {/* Room Grid */}
        {filteredRooms.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
               <LayoutGrid size={32} />
             </div>
             <h3 className="text-lg font-semibold text-slate-700">No rooms found</h3>
             <p className="text-slate-500 text-sm mt-1">
               {rooms.length === 0 ? (isAdminMode ? "Be the first to create one!" : "No rooms available.") : "Try a different search term."}
             </p>
             {!isCloud && rooms.length === 0 && (
               <p className="text-xs text-slate-400 mt-4 max-w-xs mx-auto">
                 Note: Currently in Local Mode. Click 'Connect Cloud' to see shared rooms.
               </p>
             )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRooms.map(room => (
              <div 
                key={room.id} 
                className="relative group h-full"
              >
                {/* 
                  Admin Actions Layer (Delete & Export)
                */}
                {isAdminMode && (
                  <div className="absolute top-3 right-3 z-50 flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleExportRoom(e, room)}
                      className="p-2 bg-white text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-full border border-slate-200 shadow-sm transition-all hover:scale-110 active:scale-95 cursor-pointer"
                      title="방 데이터 저장 (Export JSON)"
                    >
                      <Download size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteClick(e, room.id)}
                      className="p-2 bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full border border-slate-200 shadow-sm transition-all hover:scale-110 active:scale-95 cursor-pointer"
                      title="방 삭제하기"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}

                {/* 
                  Card Content Layer 
                  - z-index 10 (Lower than delete button)
                */}
                <div 
                  className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer h-full relative z-10"
                  onClick={() => handleJoinRoom(room)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                      {room.title.charAt(0).toUpperCase()}
                    </div>
                    {room.password && (
                      <span className="bg-amber-100 text-amber-600 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                        Private
                      </span>
                    )}
                  </div>
                  
                  <h3 className="font-bold text-lg text-slate-800 mb-1 truncate pr-8">{room.title}</h3>
                  <div className="flex items-center text-xs text-slate-400 mb-6">
                     <Users size={14} className="mr-1" />
                     <span>{room.messages.length} messages</span>
                     <span className="mx-2">•</span>
                     <span>{new Date(room.createdAt).toLocaleDateString()}</span>
                  </div>

                  <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                     <div className="flex -space-x-2">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white"></div>
                        ))}
                     </div>
                     <span className="text-indigo-500 text-sm font-semibold group-hover:translate-x-1 transition-transform flex items-center">
                       {isAdminMode ? "Enter as Admin" : "Join"} <span className="ml-1">→</span>
                     </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      {showCreateModal && (
        <CreateRoomModal 
          onClose={() => setShowCreateModal(false)} 
          onSubmit={handleCreateRoom} 
        />
      )}

      {joinModalRoom && (
        <JoinRoomModal 
          room={joinModalRoom}
          onClose={() => setJoinModalRoom(null)}
          onJoin={confirmJoin}
        />
      )}

      {showAdminLogin && (
        <AdminLoginModal 
          onClose={() => setShowAdminLogin(false)}
          onSuccess={() => setIsAdminMode(true)}
        />
      )}

      {showCloudSetup && (
        <CloudSetupModal 
          onClose={() => setShowCloudSetup(false)} 
          onSave={handleSaveFirebase} 
        />
      )}

      {/* Delete Confirmation Modal */}
      {roomToDelete && (
        <DeleteRoomModal
          onClose={() => setRoomToDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {/* Disconnect Cloud Confirmation Modal */}
      {showDisconnectModal && (
        <DisconnectCloudModal
          onClose={() => setShowDisconnectModal(false)}
          onConfirm={confirmDisconnect}
        />
      )}
    </div>
  );
};

export default App;