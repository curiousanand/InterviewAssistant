package com.interview.assistant.websocket;

/**
 * WebSocket message processing result
 * 
 * Why: Encapsulates the result of WebSocket message processing
 * Pattern: Result Object - provides structured processing outcome
 * Rationale: Enables proper error handling and response generation in WebSocket communication
 */
public class MessageProcessingResult {
    
    private final boolean success;
    private final String message;
    private final Object data;
    private final MessageType responseType;
    private final String errorCode;
    
    private MessageProcessingResult(boolean success, String message, Object data, 
                                  MessageType responseType, String errorCode) {
        this.success = success;
        this.message = message != null ? message : "";
        this.data = data;
        this.responseType = responseType;
        this.errorCode = errorCode;
    }
    
    /**
     * Create successful processing result
     */
    public static MessageProcessingResult success(Object data, MessageType responseType) {
        return new MessageProcessingResult(true, "Success", data, responseType, null);
    }
    
    /**
     * Create successful processing result with message
     */
    public static MessageProcessingResult success(String message, Object data, MessageType responseType) {
        return new MessageProcessingResult(true, message, data, responseType, null);
    }
    
    /**
     * Create error processing result
     */
    public static MessageProcessingResult error(String message, String errorCode) {
        return new MessageProcessingResult(false, message, null, MessageType.ERROR, errorCode);
    }
    
    /**
     * Create error processing result with data
     */
    public static MessageProcessingResult error(String message, String errorCode, Object data) {
        return new MessageProcessingResult(false, message, data, MessageType.ERROR, errorCode);
    }
    
    /**
     * Create acknowledgment result
     */
    public static MessageProcessingResult ack() {
        return new MessageProcessingResult(true, "Acknowledged", null, MessageType.ACK, null);
    }
    
    /**
     * Create no response result
     */
    public static MessageProcessingResult noResponse() {
        return new MessageProcessingResult(true, "No response required", null, null, null);
    }
    
    // Getters
    
    public boolean isSuccess() {
        return success;
    }
    
    public String getMessage() {
        return message;
    }
    
    public Object getData() {
        return data;
    }
    
    public MessageType getResponseType() {
        return responseType;
    }
    
    public String getErrorCode() {
        return errorCode;
    }
    
    public boolean hasResponse() {
        return responseType != null;
    }
    
    public boolean isError() {
        return !success;
    }
    
    @Override
    public String toString() {
        return String.format("MessageProcessingResult{success=%s, message='%s', responseType=%s, errorCode='%s'}", 
            success, message, responseType, errorCode);
    }
}