////////services/location-service/main.go``go
///go

package main

import (
	"context"
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/joho/godotenv"
)

var (
	ctx = context.Background()
	rdb *redis.Client
)

type Location struct {
	Latitude  float64 `json:"latitude" binding:"required"`
	Longitude float64 `json:"longitude" binding:"required"`
	UserID    string  `json:"userId" binding:"required"`
}

type NearbyUser struct {
	UserID   string  `json:"userId"`
	Distance float64 `json:"distance"`
}

func main() {
	// Load environment
	godotenv.Load()

	// Initialize Redis
	rdb = redis.NewClient(&redis.Options{
		Addr:     os.Getenv("REDIS_URL"),
		Password: os.Getenv("REDIS_PASSWORD"),
		DB:       0,
	})

	// Test connection
	if _, err := rdb.Ping(ctx).Result(); err != nil {
		log.Fatal("Redis connection failed:", err)
	}

	// Setup Gin
	router := gin.Default()
	router.Use(corsMiddleware())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "location-service"})
	})

	// Routes
	router.POST("/api/v1/location/update", updateLocation)
	router.GET("/api/v1/location/nearby", getNearbyUsers)
	router.DELETE("/api/v1/location/:userId", deleteLocation)

	port := os.Getenv("LOCATION_SERVICE_PORT")
	if port == "" {
		port = "9000"
	}

	log.Printf("📍 Location Service running on port %s", port)
	router.Run(":" + port)
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		
		c.Next()
	}
}

func updateLocation(c *gin.Context) {
	var loc Location
	if err := c.ShouldBindJSON(&loc); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// Store in Redis Geo
	err := rdb.GeoAdd(ctx, "user_locations", &redis.GeoLocation{
		Name:      loc.UserID,
		Longitude: loc.Longitude,
		Latitude:  loc.Latitude,
	}).Err()

	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to update location"})
		return
	}

	// Set expiry (1 hour)
	rdb.Expire(ctx, "user_locations", 3600)

	c.JSON(200, gin.H{"message": "Location updated successfully"})
}

func getNearbyUsers(c *gin.Context) {
	userId := c.Query("userId")
	radiusKm := c.DefaultQuery("radius", "50")

	// Get user's location
	locations, err := rdb.GeoPos(ctx, "user_locations", userId).Result()
	if err != nil || len(locations) == 0 {
		c.JSON(404, gin.H{"error": "User location not found"})
		return
	}

	userLoc := locations[0]

	// Find nearby users
	results, err := rdb.GeoRadius(ctx, "user_locations", userLoc.Longitude, userLoc.Latitude, &redis.GeoRadiusQuery{
		Radius:   parseFloat(radiusKm),
		Unit:     "km",
		WithDist: true,
		Count:    100,
		Sort:     "ASC",
	}).Result()

	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to find nearby users"})
		return
	}

	var nearbyUsers []NearbyUser
	for _, result := range results {
		if result.Name != userId {
			nearbyUsers = append(nearbyUsers, NearbyUser{
				UserID:   result.Name,
				Distance: result.Dist,
			})
		}
	}

	c.JSON(200, gin.H{"users": nearbyUsers})
}

func deleteLocation(c *gin.Context) {
	userId := c.Param("userId")
	
	err := rdb.ZRem(ctx, "user_locations", userId).Err()
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to delete location"})
		return
	}

	c.JSON(200, gin.H{"message": "Location deleted successfully"})
}

func parseFloat(s string) float64 {
	var f float64
	_, _ = fmt.Sscanf(s, "%f", &f)
	return f
}