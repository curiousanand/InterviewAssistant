package com.interview.assistant.service;

import com.interview.assistant.model.ConversationContext;
import com.interview.assistant.model.ConversationMessage;
import com.interview.assistant.model.ConversationSession;
import com.interview.assistant.model.SilenceDetectionResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Smart conversation logic service for intelligent conversation management
 * <p>
 * Why: Provides intelligent conversation flow decisions and adaptive responses
 * Pattern: Strategy + Decision Engine - makes smart decisions about conversation flow
 * Rationale: Essential for natural conversation experience with context-aware responses
 */
@Service
public class ConversationIntelligenceService {

    private static final Logger logger = LoggerFactory.getLogger(ConversationIntelligenceService.class);
    // Intelligence configuration
    private static final double HIGH_CONFIDENCE_THRESHOLD = 0.85;
    private static final double LOW_CONFIDENCE_THRESHOLD = 0.4;
    private static final long RESPONSE_DELAY_MS = 1500; // Wait before responding
    private static final int MAX_CLARIFICATION_ATTEMPTS = 2;
    @Autowired
    private ConversationContextManager contextManager;

    /**
     * Determine optimal response strategy based on conversation state
     */
    public ResponseStrategy determineResponseStrategy(ConversationContext context,
                                                      SilenceDetectionResult silenceResult) {

        logger.debug("Determining response strategy for session: {}", context.getSessionId());

        // Analyze conversation characteristics
        ConversationAnalysis analysis = analyzeConversation(context);

        // Determine urgency based on silence type
        ResponseUrgency urgency = determineResponseUrgency(silenceResult, analysis);

        // Determine response type based on context and confidence
        ResponseType responseType = determineResponseType(context, analysis);

        // Calculate response delay
        long responseDelay = calculateOptimalDelay(silenceResult, analysis);

        return new ResponseStrategy(responseType, urgency, responseDelay, analysis);
    }

    /**
     * Generate context-aware system prompt based on conversation state
     */
    public String generateAdaptiveSystemPrompt(ConversationContext context) {
        ConversationAnalysis analysis = analyzeConversation(context);

        StringBuilder prompt = new StringBuilder();
        prompt.append("You are a helpful AI assistant in a real-time conversation. ");

        // Adapt based on conversation characteristics
        if (analysis.getAverageConfidence() < LOW_CONFIDENCE_THRESHOLD) {
            prompt.append("The user's speech may be unclear or noisy. ");
            prompt.append("Ask for clarification if needed and provide clear, simple responses. ");
        } else if (analysis.getAverageConfidence() > HIGH_CONFIDENCE_THRESHOLD) {
            prompt.append("The conversation is clear and confident. ");
            prompt.append("You can provide more detailed and nuanced responses. ");
        }

        // Adapt based on conversation topic
        Set<String> topics = new HashSet<>(analysis.getTopics());
        if (!topics.isEmpty()) {
            String topicsStr = String.join(", ", topics);
            prompt.append(String.format("The conversation topics include: %s. ", topicsStr));
            prompt.append("Stay relevant to these topics while being helpful. ");
        }

        // Adapt based on conversation length
        if (analysis.getTotalMessages() > 10) {
            prompt.append("This is an extended conversation. ");
            prompt.append("Reference previous context appropriately and maintain consistency. ");
        } else if (analysis.getTotalMessages() < 3) {
            prompt.append("This is a new conversation. ");
            prompt.append("Be welcoming and help establish the conversation direction. ");
        }

        // Response style adaptation
        prompt.append("Keep responses conversational and concise for voice interaction. ");
        prompt.append("Focus on being helpful, accurate, and naturally engaging.");

        return prompt.toString();
    }

    /**
     * Determine if conversation needs intervention (e.g., clarification, topic change)
     */
    public ConversationIntervention analyzeForIntervention(ConversationContext context,
                                                           ConversationSession session) {

        ConversationAnalysis analysis = analyzeConversation(context);
        List<InterventionType> interventions = new ArrayList<>();

        // Check for low confidence pattern
        if (analysis.getAverageConfidence() < LOW_CONFIDENCE_THRESHOLD &&
                analysis.getTotalMessages() >= 3) {
            interventions.add(InterventionType.REQUEST_CLARIFICATION);
        }

        // Check for repetitive conversation
        if (detectRepetitivePattern(context)) {
            interventions.add(InterventionType.SUGGEST_TOPIC_CHANGE);
        }

        // Check for long silence after question
        if (session.getCurrentSilenceDuration() > 10000 &&
                wasLastMessageQuestion(context)) {
            interventions.add(InterventionType.OFFER_HELP);
        }

        // Check for conversation stagnation
        if (analysis.getTotalMessages() > 5 &&
                calculateConversationProgress(context) < 0.3) {
            interventions.add(InterventionType.REDIRECT_CONVERSATION);
        }

        return new ConversationIntervention(interventions, analysis);
    }

    /**
     * Generate intelligent follow-up questions based on conversation context
     */
    public List<String> generateFollowUpQuestions(ConversationContext context) {
        List<String> questions = new ArrayList<>();
        ConversationAnalysis analysis = analyzeConversation(context);

        // Generate questions based on topics
        Set<String> topics = new HashSet<>(analysis.getTopics());
        for (String topic : topics) {
            questions.addAll(generateTopicQuestions(topic));
        }

        // Generate questions based on entities
        Set<String> entities = contextManager.extractEntities(
                context.getMessages().stream()
                        .map(ConversationMessage::getContent)
                        .collect(Collectors.joining(" "))
        );

        for (String entity : entities) {
            questions.addAll(generateEntityQuestions(entity));
        }

        // Limit and rank questions
        return questions.stream()
                .distinct()
                .limit(3)
                .collect(Collectors.toList());
    }

    /**
     * Comprehensive conversation analysis
     */
    private ConversationAnalysis analyzeConversation(ConversationContext context) {
        List<ConversationMessage> messages = context.getMessages();

        if (messages.isEmpty()) {
            return new ConversationAnalysis(0, 0.0, Collections.emptyList(),
                    Collections.emptyList(), 0.0, ConversationTone.NEUTRAL);
        }

        // Calculate average confidence
        double avgConfidence = messages.stream()
                .mapToDouble(ConversationMessage::getConfidence)
                .average().orElse(0.0);

        // Extract topics and entities
        List<String> topics = new ArrayList<>(contextManager.extractTopics(messages));

        String allText = messages.stream()
                .map(ConversationMessage::getContent)
                .collect(Collectors.joining(" "));
        List<String> entities = new ArrayList<>(contextManager.extractEntities(allText));

        // Calculate conversation momentum
        double momentum = calculateConversationMomentum(messages);

        // Determine conversation tone
        ConversationTone tone = determineConversationTone(messages);

        return new ConversationAnalysis(messages.size(), avgConfidence, topics,
                entities, momentum, tone);
    }

    /**
     * Determine response urgency based on silence patterns
     */
    private ResponseUrgency determineResponseUrgency(SilenceDetectionResult silenceResult,
                                                     ConversationAnalysis analysis) {
        SilenceDetectionResult.SilenceType type = silenceResult.getSilenceType();

        if (type == SilenceDetectionResult.SilenceType.WAITING_FOR_RESPONSE) {
            return ResponseUrgency.HIGH;
        } else if (type == SilenceDetectionResult.SilenceType.END_OF_THOUGHT) {
            return analysis.getAverageConfidence() > HIGH_CONFIDENCE_THRESHOLD ?
                    ResponseUrgency.NORMAL : ResponseUrgency.LOW;
        } else if (type == SilenceDetectionResult.SilenceType.NATURAL_GAP) {
            return ResponseUrgency.LOW;
        } else if (type == SilenceDetectionResult.SilenceType.TIMEOUT) {
            return ResponseUrgency.HIGH;
        } else {
            return ResponseUrgency.NORMAL;
        }
    }

    /**
     * Determine optimal response type
     */
    private ResponseType determineResponseType(ConversationContext context,
                                               ConversationAnalysis analysis) {

        // Check if last message was a question
        if (wasLastMessageQuestion(context)) {
            return ResponseType.DIRECT_ANSWER;
        }

        // Check confidence levels
        if (analysis.getAverageConfidence() < LOW_CONFIDENCE_THRESHOLD) {
            return ResponseType.CLARIFICATION_REQUEST;
        }

        // Check for conversation stagnation
        if (analysis.getMomentum() < 0.3) {
            return ResponseType.CONVERSATION_STARTER;
        }

        // Default to contextual response
        return ResponseType.CONTEXTUAL_RESPONSE;
    }

    /**
     * Calculate optimal response delay
     */
    private long calculateOptimalDelay(SilenceDetectionResult silenceResult,
                                       ConversationAnalysis analysis) {
        long baseDelay = RESPONSE_DELAY_MS;

        // Adjust for silence type
        switch (silenceResult.getSilenceType()) {
            case WAITING_FOR_RESPONSE:
                return Math.min(baseDelay / 2, 750); // Respond quickly
            case END_OF_THOUGHT:
                return baseDelay; // Normal delay
            case NATURAL_GAP:
                return baseDelay * 2; // Wait longer
            default:
                return baseDelay;
        }
    }

    /**
     * Check if last message was a question
     */
    private boolean wasLastMessageQuestion(ConversationContext context) {
        return context.getLatestMessage()
                .map(msg -> msg.getContent().trim().endsWith("?") ||
                        containsQuestionWords(msg.getContent()))
                .orElse(false);
    }

    /**
     * Check if text contains question words
     */
    private boolean containsQuestionWords(String text) {
        String lowerText = text.toLowerCase();
        String[] questionWords = {"what", "when", "where", "who", "why", "how", "which",
                "can", "could", "would", "should", "is", "are", "do", "does", "did"};

        for (String word : questionWords) {
            if (lowerText.contains(word + " ")) {
                return true;
            }
        }
        return false;
    }

    /**
     * Detect repetitive conversation patterns
     */
    private boolean detectRepetitivePattern(ConversationContext context) {
        List<ConversationMessage> messages = context.getMessages();
        if (messages.size() < 4) return false;

        // Check for repeated phrases in recent messages
        int recentCount = Math.min(4, messages.size());
        List<String> recentTexts = messages.subList(messages.size() - recentCount, messages.size())
                .stream()
                .map(msg -> msg.getContent().toLowerCase())
                .collect(Collectors.toList());

        // Simple repetition detection
        for (int i = 0; i < recentTexts.size() - 1; i++) {
            for (int j = i + 1; j < recentTexts.size(); j++) {
                if (calculateTextSimilarity(recentTexts.get(i), recentTexts.get(j)) > 0.7) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Calculate conversation progress/momentum
     */
    private double calculateConversationProgress(ConversationContext context) {
        List<ConversationMessage> messages = context.getMessages();
        if (messages.size() < 2) return 1.0;

        // Calculate topic diversity
        Set<String> topics = contextManager.extractTopics(messages);
        double topicDiversity = Math.min(topics.size() / 3.0, 1.0);

        // Calculate information density
        double avgLength = messages.stream()
                .mapToInt(ConversationMessage::getWordCount)
                .average().orElse(0.0);
        double informationDensity = Math.min(avgLength / 10.0, 1.0);

        return (topicDiversity + informationDensity) / 2.0;
    }

    /**
     * Calculate conversation momentum
     */
    private double calculateConversationMomentum(List<ConversationMessage> messages) {
        if (messages.size() < 2) return 1.0;

        // Calculate based on message frequency and length
        long timeSpan = messages.get(messages.size() - 1).getTimestamp() -
                messages.get(0).getTimestamp();

        if (timeSpan <= 0) return 1.0;

        double messageRate = (double) messages.size() / (timeSpan / 60000.0); // Messages per minute
        double lengthTrend = calculateLengthTrend(messages);

        return Math.min((messageRate * lengthTrend) / 5.0, 1.0);
    }

    /**
     * Determine conversation tone
     */
    private ConversationTone determineConversationTone(List<ConversationMessage> messages) {
        // Simple tone analysis based on content patterns
        String allText = messages.stream()
                .map(ConversationMessage::getContent)
                .collect(Collectors.joining(" "))
                .toLowerCase();

        int positiveWords = countWords(allText, new String[]{"good", "great", "excellent", "amazing", "wonderful", "thank", "please"});
        int negativeWords = countWords(allText, new String[]{"bad", "terrible", "awful", "problem", "issue", "error", "wrong"});
        int questionWords = countWords(allText, new String[]{"what", "how", "when", "where", "why", "which"});

        if (positiveWords > negativeWords && positiveWords > questionWords) {
            return ConversationTone.POSITIVE;
        } else if (negativeWords > positiveWords) {
            return ConversationTone.NEGATIVE;
        } else if (questionWords > positiveWords + negativeWords) {
            return ConversationTone.INQUISITIVE;
        } else {
            return ConversationTone.NEUTRAL;
        }
    }

    /**
     * Utility methods
     */
    private double calculateTextSimilarity(String text1, String text2) {
        if (text1.equals(text2)) return 1.0;

        String[] words1 = text1.split("\\s+");
        String[] words2 = text2.split("\\s+");

        Set<String> set1 = new HashSet<>(Arrays.asList(words1));
        Set<String> set2 = new HashSet<>(Arrays.asList(words2));

        Set<String> intersection = new HashSet<>(set1);
        intersection.retainAll(set2);

        Set<String> union = new HashSet<>(set1);
        union.addAll(set2);

        return union.isEmpty() ? 0.0 : (double) intersection.size() / union.size();
    }

    private double calculateLengthTrend(List<ConversationMessage> messages) {
        if (messages.size() < 3) return 1.0;

        int recentCount = Math.min(3, messages.size());
        List<Integer> recentLengths = messages.subList(messages.size() - recentCount, messages.size())
                .stream()
                .map(ConversationMessage::getWordCount)
                .collect(Collectors.toList());

        // Simple trend calculation
        return recentLengths.get(recentLengths.size() - 1) > recentLengths.get(0) ? 1.2 : 0.8;
    }

    private int countWords(String text, String[] words) {
        int count = 0;
        for (String word : words) {
            count += (text.length() - text.replace(word, "").length()) / word.length();
        }
        return count;
    }

    private List<String> generateTopicQuestions(String topic) {
        return List.of(
                "Can you tell me more about " + topic + "?",
                "What's your experience with " + topic + "?",
                "How do you feel about " + topic + "?"
        );
    }

    private List<String> generateEntityQuestions(String entity) {
        return List.of(
                "What can you tell me about " + entity + "?",
                "How is " + entity + " relevant to our conversation?"
        );
    }

    // Data classes

    public enum ResponseType {
        DIRECT_ANSWER, CLARIFICATION_REQUEST, CONTEXTUAL_RESPONSE, CONVERSATION_STARTER
    }

    public enum ResponseUrgency {
        LOW, NORMAL, HIGH
    }

    public enum ConversationTone {
        POSITIVE, NEGATIVE, NEUTRAL, INQUISITIVE
    }

    public enum InterventionType {
        REQUEST_CLARIFICATION, SUGGEST_TOPIC_CHANGE, OFFER_HELP, REDIRECT_CONVERSATION
    }

    public static class ResponseStrategy {
        private final ResponseType responseType;
        private final ResponseUrgency urgency;
        private final long responseDelay;
        private final ConversationAnalysis analysis;

        public ResponseStrategy(ResponseType responseType, ResponseUrgency urgency,
                                long responseDelay, ConversationAnalysis analysis) {
            this.responseType = responseType;
            this.urgency = urgency;
            this.responseDelay = responseDelay;
            this.analysis = analysis;
        }

        public ResponseType getResponseType() {
            return responseType;
        }

        public ResponseUrgency getUrgency() {
            return urgency;
        }

        public long getResponseDelay() {
            return responseDelay;
        }

        public ConversationAnalysis getAnalysis() {
            return analysis;
        }

        @Override
        public String toString() {
            return String.format("ResponseStrategy{type=%s, urgency=%s, delay=%dms}",
                    responseType, urgency, responseDelay);
        }
    }

    public static class ConversationAnalysis {
        private final int totalMessages;
        private final double averageConfidence;
        private final List<String> topics;
        private final List<String> entities;
        private final double momentum;
        private final ConversationTone tone;

        public ConversationAnalysis(int totalMessages, double averageConfidence,
                                    List<String> topics, List<String> entities,
                                    double momentum, ConversationTone tone) {
            this.totalMessages = totalMessages;
            this.averageConfidence = averageConfidence;
            this.topics = new ArrayList<>(topics);
            this.entities = new ArrayList<>(entities);
            this.momentum = momentum;
            this.tone = tone;
        }

        public int getTotalMessages() {
            return totalMessages;
        }

        public double getAverageConfidence() {
            return averageConfidence;
        }

        public List<String> getTopics() {
            return new ArrayList<>(topics);
        }

        public List<String> getEntities() {
            return new ArrayList<>(entities);
        }

        public double getMomentum() {
            return momentum;
        }

        public ConversationTone getTone() {
            return tone;
        }

        @Override
        public String toString() {
            return String.format("ConversationAnalysis{messages=%d, confidence=%.2f, topics=%d, momentum=%.2f, tone=%s}",
                    totalMessages, averageConfidence, topics.size(), momentum, tone);
        }
    }

    public static class ConversationIntervention {
        private final List<InterventionType> interventions;
        private final ConversationAnalysis analysis;

        public ConversationIntervention(List<InterventionType> interventions,
                                        ConversationAnalysis analysis) {
            this.interventions = new ArrayList<>(interventions);
            this.analysis = analysis;
        }

        public boolean needsIntervention() {
            return !interventions.isEmpty();
        }

        public List<InterventionType> getInterventions() {
            return new ArrayList<>(interventions);
        }

        public ConversationAnalysis getAnalysis() {
            return analysis;
        }

        @Override
        public String toString() {
            return String.format("ConversationIntervention{needed=%s, types=%s}",
                    needsIntervention(), interventions);
        }
    }
}