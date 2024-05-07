
export default (sequelize, DataTypes) => {
    const Video = sequelize.define("video", {
        id: {
            type: DataTypes.STRING,
            primaryKey: true,
        },
        title: {
            type: DataTypes.STRING
        },
        thumbnail_url: {
            type: DataTypes.STRING
        },
        channel_title: {
            type: DataTypes.STRING
        },
        duration: {
            type: DataTypes.INTEGER
        }
    });

    return Video;
};