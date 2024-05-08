
export default (sequelize, DataTypes) => {
    const Comment = sequelize.define("comment", {
        video_id: {
            type: DataTypes.STRING,
            references: {
                model: 'videos',
                key: 'id'
            }
        },
        channel_name: {
            type: DataTypes.STRING
        },
        channel_thumbnail: {
            type: DataTypes.STRING
        },
        content: {
            type: DataTypes.STRING
        },
        date: {
            type: DataTypes.DATE
        }
    });

    return Comment;
};
