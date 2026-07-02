import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";

@WebSocketGateway({
  cors: { origin: "*", credentials: true },
  namespace: "/ws",
})
export class AgentsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AgentsGateway.name);
  private connectedClients = 0;

  handleConnection(client: Socket) {
    this.connectedClients++;
    this.logger.debug(`Client connected: ${client.id} (total: ${this.connectedClients})`);
  }

  handleDisconnect(client: Socket) {
    this.connectedClients--;
    this.logger.debug(`Client disconnected: ${client.id} (total: ${this.connectedClients})`);
  }

  emitAgentThought(thought: any) {
    this.server?.emit("agent:thought", {
      ...thought,
      timestamp: new Date().toISOString(),
    });
  }

  emitAgentStarted(agentName: string, taskType: string) {
    this.server?.emit("agent:started", {
      agentName,
      taskType,
      timestamp: new Date().toISOString(),
    });
  }

  emitAgentCompleted(agentName: string, result: any) {
    this.server?.emit("agent:completed", {
      agentName,
      result,
      timestamp: new Date().toISOString(),
    });
  }

  emitWorkflowStarted(question: string) {
    this.server?.emit("workflow:started", {
      question,
      timestamp: new Date().toISOString(),
    });
  }

  emitWorkflowCompleted(response: any) {
    this.server?.emit("workflow:completed", {
      response,
      timestamp: new Date().toISOString(),
    });
  }

  emitRiskUpdate(assetId: string, riskScore: number, severity: string) {
    this.server?.emit("risk:updated", { assetId, riskScore, severity, timestamp: new Date().toISOString() });
  }

  emitIncidentCreated(incident: any) {
    this.server?.emit("incident:created", { incident, timestamp: new Date().toISOString() });
  }

  emitTwinUpdate(update: any) {
    this.server?.emit("twin:update", { ...update, timestamp: new Date().toISOString() });
  }

  @SubscribeMessage("ping")
  handlePing(client: Socket) {
    client.emit("pong", { timestamp: new Date().toISOString() });
  }
}
