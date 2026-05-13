import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../services/authApi';

export interface AuthUser
{
    id : string;
    email : string;
    role : string;
}

interface AuthState
{
    accessToken : string | null;
    refreshToken : string | null;
    user : AuthUser | null;

    login : (email : string, password : string) => Promise<void>;
    refreshSession : () => Promise<string>;
    logout : () => void;
    setUser : (user : AuthUser) => void;
}