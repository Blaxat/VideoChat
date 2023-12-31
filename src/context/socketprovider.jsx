import React, {createContext, useMemo, useContext} from "react";
import { io } from "socket.io-client";


const SocketContext  = createContext(null);

export const useSocketContext = () =>{
    const socket = useContext(SocketContext);
    return socket;
};

export const SocketProvider = (props) =>{
    const socket = useMemo(() => io("https://vidchat-fw2t.onrender.com"),[]);

    return(
        <SocketContext.Provider value = {socket}>
            {props.children}
        </SocketContext.Provider>
    );
};
