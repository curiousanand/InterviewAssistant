'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { IAudioCapture, IWebSocketClient } from '@/types';
import { ServiceFactory } from './serviceFactory';

interface ServiceContextType {
  audioFactory: {
    createCapture: () => IAudioCapture;
  };
  wsFactory: {
    createClient: () => IWebSocketClient;
  };
}

const ServiceContext = createContext<ServiceContextType | null>(null);

interface ServiceProviderProps {
  children: ReactNode;
  services?: Partial<ServiceContextType>;
}

export function ServiceProvider({ children, services }: ServiceProviderProps) {
  const defaultServices: ServiceContextType = {
    audioFactory: {
      createCapture: () => ServiceFactory.createAudioCapture(),
    },
    wsFactory: {
      createClient: () => ServiceFactory.createWebSocketClient(),
    },
  };

  const contextValue = {
    ...defaultServices,
    ...services,
  };

  return (
    <ServiceContext.Provider value={contextValue}>
      {children}
    </ServiceContext.Provider>
  );
}

export function useServices() {
  const context = useContext(ServiceContext);
  if (!context) {
    throw new Error('useServices must be used within a ServiceProvider');
  }
  return context;
}

export function useAudioFactory() {
  const { audioFactory } = useServices();
  return audioFactory;
}

export function useWebSocketFactory() {
  const { wsFactory } = useServices();
  return wsFactory;
}