/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ORBITRA'26 CUBESAT MISSION CONTROL // TEAM COSMIC ERA
 * MMMUT Gorakhpur (Drone & IoT Club)
 */

import React, { useState } from 'react';
import { ActiveTab } from './types/telemetry';
import { useTelemetry } from './hooks/useTelemetry';
import { Header, Footer } from './components/Header';
import { StatusStrip } from './components/StatusStrip';
import { PrimaryHudTab } from './components/tabs/PrimaryHudTab';
import { MotionAlertTab } from './components/tabs/MotionAlertTab';
import { DiagnosticsGraphsTab } from './components/tabs/DiagnosticsGraphsTab';
import { GpsTrackingTab } from './components/tabs/GpsTrackingTab';
import { MissionControlsTab } from './components/tabs/MissionControlsTab';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('primary');

  const {
    connectionMode,
    connectionState,
    baudRate,
    setBaudRate,
    wsUrl,
    setWsUrl,
    isPaused,
    setIsPaused,
    connectionError,
    rawBytesCount,
    validPacketCount,
    currentPacket,
    packetHistory,
    groundBaselineAlt,
    maxApogee,
    verticalSpeed,
    jitterLimit,
    setJitterLimit,
    incidentLog,
    isAlertState,
    satellites,
    serialLogs,
    setSerialLogs,
    packetCount,
    packetLoss,
    linkAgeMs,
    bitrateKbps,
    missionElapsedSeconds,
    connectSerial,
    disconnectSerial,
    forceResetSerial,
    pulseDTR,
    rebootESP32,
    injectTestPacket,
    connectWebSocket,
    sendCommand,
    calibrateBaseline,
    tareZero,
    injectShock,
    tumbleImpulse,
    toggleDemoMode,
    exportCSV,
  } = useTelemetry();

  return (
    <div className="min-h-screen bg-[#060b14] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Header & Tab Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        connectionState={connectionState}
        connectionMode={connectionMode}
        packetCount={packetCount}
        packetLoss={packetLoss}
        bitrateKbps={bitrateKbps}
      />

      {/* Top Telemetry Status Strip */}
      <StatusStrip
        connectionState={connectionState}
        connectionMode={connectionMode}
        missionElapsedSeconds={missionElapsedSeconds}
        packetCount={packetCount}
        packetLoss={packetLoss}
        linkAgeMs={linkAgeMs}
        toggleDemoMode={toggleDemoMode}
      />

      {/* Tab Panels */}
      <main className="flex-1 w-full">
        {activeTab === 'primary' && (
          <PrimaryHudTab
            packet={currentPacket}
            packetHistory={packetHistory}
            connectionState={connectionState}
            groundBaselineAlt={groundBaselineAlt}
            maxApogee={maxApogee}
            verticalSpeed={verticalSpeed}
            jitterLimit={jitterLimit}
            isPaused={isPaused}
            setIsPaused={setIsPaused}
            connectSerial={connectSerial}
            calibrateBaseline={calibrateBaseline}
            exportCSV={exportCSV}
            forceResetSerial={forceResetSerial}
            pulseDTR={pulseDTR}
            rebootESP32={rebootESP32}
            injectTestPacket={injectTestPacket}
          />
        )}

        {activeTab === 'motion' && (
          <MotionAlertTab
            packet={currentPacket}
            packetHistory={packetHistory}
            connectionMode={connectionMode}
            jitterLimit={jitterLimit}
            setJitterLimit={setJitterLimit}
            incidentLog={incidentLog}
            isAlertState={isAlertState}
            tareZero={tareZero}
            injectShock={injectShock}
            tumbleImpulse={tumbleImpulse}
          />
        )}

        {activeTab === 'diagnostics' && (
          <DiagnosticsGraphsTab
            packetHistory={packetHistory}
            currentPacket={currentPacket}
            isPaused={isPaused}
            setIsPaused={setIsPaused}
          />
        )}

        {activeTab === 'gps' && (
          <GpsTrackingTab
            packet={currentPacket}
            packetHistory={packetHistory}
            satellites={satellites}
            connectionMode={connectionMode}
          />
        )}

        {activeTab === 'controls' && (
          <MissionControlsTab
            connectionState={connectionState}
            connectionMode={connectionMode}
            baudRate={baudRate}
            setBaudRate={setBaudRate}
            wsUrl={wsUrl}
            setWsUrl={setWsUrl}
            serialLogs={serialLogs}
            setSerialLogs={setSerialLogs}
            connectionError={connectionError}
            rawBytesCount={rawBytesCount}
            validPacketCount={validPacketCount}
            currentPacket={currentPacket}
            connectSerial={connectSerial}
            disconnectSerial={disconnectSerial}
            connectWebSocket={connectWebSocket}
            sendCommand={sendCommand}
            exportCSV={exportCSV}
            tareZero={tareZero}
            forceResetSerial={forceResetSerial}
            pulseDTR={pulseDTR}
            rebootESP32={rebootESP32}
            injectTestPacket={injectTestPacket}
          />
        )}
      </main>

      {/* Persistent Global Mission Control Footer */}
      <Footer packetLoss={packetLoss} bitrateKbps={bitrateKbps} />
    </div>
  );
}
